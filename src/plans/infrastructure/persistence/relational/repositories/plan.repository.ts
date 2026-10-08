import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { PlanEntity } from '../entities/plan.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterPlanDto, SortPlanDto } from '../../../../dto/query-plan.dto';
import { Plan } from '../../../../domain/plan';
import { LocalStockSummary, PlanRepository } from '../../plan.repository';
import { PlanMapper } from '../mappers/plan.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import {
  COMPLETED_ORDER_ITEM_STATUSES,
  COMPLETED_ORDER_STATUSES,
} from '../../../../../overview/dto/overview.dto';

/**
 * A plan's real cost: the supplier's price plus that supplier's surcharge —
 * the tax/fees on top of what their API quotes (v3 #018). `costPrice` stays the
 * raw API figure, because every 6-hourly sync overwrites it; everything derived
 * from cost (the cost columns the CMS shows, the margin-tier selling price, the
 * order cost snapshot) reads this instead, so a surcharge raises "giá vốn".
 */
export const EFFECTIVE_COST_SQL = `("costPrice" * (1 + COALESCE((SELECT s."percentage" FROM "provider_surcharge" s WHERE s."provider" = "plan"."provider"), 0) / 100))`;

@Injectable()
export class PlansRelationalRepository implements PlanRepository {
  constructor(
    @InjectRepository(PlanEntity)
    private readonly plansRepository: Repository<PlanEntity>,
  ) {}

  async create(data: Plan): Promise<Plan> {
    const persistenceModel = PlanMapper.toPersistence(data);
    const newEntity = await this.plansRepository.save(
      this.plansRepository.create(persistenceModel),
    );
    return PlanMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterPlanDto | null;
    sortOptions?: SortPlanDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Plan[], number]> {
    if (filterOptions?.search) {
      const qb = this.plansRepository
        .createQueryBuilder('plan')
        .leftJoinAndSelect('plan.destination', 'dest')
        .leftJoinAndSelect('plan.region', 'region')
        .leftJoin('region.destinations', 'regionDest')
        .leftJoin('destination', 'child', 'child."parentId" = dest.id');

      qb.where(
        '(plan.name ILIKE :search OR plan."countryCode" ILIKE :search OR dest.name ILIKE :search OR dest."keySearch" ILIKE :search OR dest."countryCode" ILIKE :search OR child.name ILIKE :search OR child."keySearch" ILIKE :search OR child."countryCode" ILIKE :search OR region.name ILIKE :search OR region.slug ILIKE :search OR regionDest.name ILIKE :search OR regionDest.keySearch ILIKE :search OR regionDest.countryCode ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );

      this.applyColumnFilters(qb, filterOptions);
      this.applyLocationAndCallSmsFilters(qb, filterOptions);
      if (filterOptions?.duration !== undefined) {
        qb.andWhere('plan."durationDays" = :duration', {
          duration: filterOptions.duration,
        });
      }
      if (filterOptions?.type) {
        const planTypes =
          typeof filterOptions.type === 'string'
            ? filterOptions.type
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : Array.isArray(filterOptions.type)
              ? filterOptions.type
              : [filterOptions.type];
        if (planTypes.length > 0) {
          qb.andWhere('plan."type" IN (:...planTypes)', { planTypes });
        }
      }
      if (filterOptions?.data) {
        const dataMb = this.parseDataToMb(filterOptions.data);
        if (dataMb > 0) {
          qb.andWhere('plan."dataMb" = :dataMb', { dataMb });
        }
      }
      if (filterOptions?.tags?.length) {
        qb.andWhere('plan."tags" @> :tags', {
          tags: JSON.stringify(filterOptions.tags),
        });
      }

      if (sortOptions?.length) {
        for (const sort of sortOptions) {
          qb.addOrderBy(
            `plan.${String(sort.orderBy)}`,
            sort.order as 'ASC' | 'DESC',
          );
        }
      } else {
        qb.orderBy('plan.createdAt', 'DESC');
      }

      const count = await qb.getCount();

      qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
      qb.take(paginationOptions.limit);

      const entities = await qb.getMany();
      return [entities.map((entity) => PlanMapper.toDomain(entity)), count];
    }

    const where: any = {};

    if (filterOptions?.isCheapest !== undefined) {
      where.isCheapest = filterOptions.isCheapest;
    }
    if (filterOptions?.isActive !== undefined) {
      where.isActive = filterOptions.isActive;
    }
    if (filterOptions?.isLocalInventory !== undefined) {
      where.isLocalInventory = filterOptions.isLocalInventory;
    }
    if (filterOptions?.isDomesticEsim !== undefined) {
      where.isDomesticEsim = filterOptions.isDomesticEsim;
    }
    if (filterOptions?.destinationId !== undefined) {
      where.destinationId = filterOptions.destinationId;
    }
    if (filterOptions?.regionId !== undefined) {
      where.regionId = filterOptions.regionId;
    }
    if (filterOptions?.provider?.length) {
      where.provider = In(filterOptions.provider);
    }
    if (filterOptions?.apn) {
      where.apn = filterOptions.apn;
    }
    if (filterOptions?.isNonHkIp !== undefined) {
      where.isNonHkIp = filterOptions.isNonHkIp;
    }
    if (filterOptions?.topUp !== undefined) {
      where.topUp = filterOptions.topUp;
    }

    // Joined location and call/SMS filters require a query builder.
    if (
      filterOptions?.duration !== undefined ||
      filterOptions?.type ||
      filterOptions?.data ||
      filterOptions?.tags?.length ||
      filterOptions?.country ||
      filterOptions?.hasCallSms !== undefined
    ) {
      const qb = this.plansRepository.createQueryBuilder('plan');
      qb.leftJoinAndSelect('plan.destination', 'dest');
      qb.leftJoinAndSelect('plan.region', 'region');
      qb.leftJoin('region.destinations', 'regionDest');
      qb.leftJoin('destination', 'child', 'child."parentId" = dest.id');

      this.applyColumnFilters(qb, filterOptions);
      this.applyLocationAndCallSmsFilters(qb, filterOptions);
      if (filterOptions.duration !== undefined) {
        qb.andWhere('plan."durationDays" = :duration', {
          duration: filterOptions.duration,
        });
      }
      if (filterOptions.type) {
        const planTypes =
          typeof filterOptions.type === 'string'
            ? filterOptions.type
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : Array.isArray(filterOptions.type)
              ? filterOptions.type
              : [filterOptions.type];
        if (planTypes.length > 0) {
          qb.andWhere('plan."type" IN (:...planTypes)', { planTypes });
        }
      }
      if (filterOptions.data) {
        const dataMb = this.parseDataToMb(filterOptions.data);
        if (dataMb > 0) {
          qb.andWhere('plan."dataMb" = :dataMb', { dataMb });
        }
      }
      if (filterOptions.tags?.length) {
        qb.andWhere('plan."tags" @> :tags', {
          tags: JSON.stringify(filterOptions.tags),
        });
      }

      if (sortOptions?.length) {
        for (const sort of sortOptions) {
          qb.addOrderBy(
            `plan.${String(sort.orderBy)}`,
            sort.order as 'ASC' | 'DESC',
          );
        }
      } else {
        qb.orderBy('plan.createdAt', 'DESC');
      }

      qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
      qb.take(paginationOptions.limit);

      const [entities, count] = await qb.getManyAndCount();
      return [entities.map((entity) => PlanMapper.toDomain(entity)), count];
    }

    const [entities, count] = await this.plansRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.length
        ? sortOptions.reduce(
            (accumulator, sort) => ({
              ...accumulator,
              [sort.orderBy]: sort.order,
            }),
            {},
          )
        : { createdAt: 'DESC' },
    });

    return [entities.map((entity) => PlanMapper.toDomain(entity)), count];
  }

  async findById(id: Plan['id']): Promise<NullableType<Plan>> {
    const entity = await this.plansRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? PlanMapper.toDomain(entity) : null;
  }

  async findBySlug(slug: Plan['slug']): Promise<NullableType<Plan>> {
    const entity = await this.plansRepository.findOne({
      where: { slug },
    });
    return entity ? PlanMapper.toDomain(entity) : null;
  }

  async update(id: Plan['id'], payload: Partial<Plan>): Promise<Plan> {
    const entity = await this.plansRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Plan not found');
    }

    const updatedEntity = await this.plansRepository.save(
      this.plansRepository.create(
        PlanMapper.toPersistence({
          ...PlanMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return PlanMapper.toDomain(updatedEntity);
  }

  /**
   * Off-sale in one statement (#005): only rows that are active right now get
   * flagged, which is what makes the switch reversible — a plan an admin had
   * already deactivated is left alone and stays off when the supplier returns.
   */
  async deactivatePlansForProvider(provider: string): Promise<number> {
    const result = await this.plansRepository.query(
      `UPDATE "plan"
       SET "isActive" = false, "disabledByProvider" = true, "updatedAt" = now()
       WHERE "deletedAt" IS NULL
         AND lower("provider") = $1
         AND "isActive" = true`,
      [provider],
    );
    return Array.isArray(result) ? ((result[1] as number) ?? 0) : 0;
  }

  async reactivatePlansDisabledByProvider(provider: string): Promise<number> {
    const result = await this.plansRepository.query(
      `UPDATE "plan"
       SET "isActive" = true, "disabledByProvider" = false, "updatedAt" = now()
       WHERE "deletedAt" IS NULL
         AND lower("provider") = $1
         AND "disabledByProvider" = true`,
      [provider],
    );
    return Array.isArray(result) ? ((result[1] as number) ?? 0) : 0;
  }

  async markCheapestPlans(): Promise<void> {
    // Reset all isCheapest to false
    await this.plansRepository.query(
      `UPDATE "plan" SET "isCheapest" = false WHERE "deletedAt" IS NULL`,
    );

    // Mark cheapest plan per group (destinationId, type, dataMb, durationDays)
    // Only for plans with a destinationId (single-country plans)
    await this.plansRepository.query(`
      UPDATE "plan" SET "isCheapest" = true
      WHERE id IN (
        SELECT DISTINCT ON (p."destinationId", p."type", p."dataMb", p."durationDays") p.id
        FROM "plan" p
        LEFT JOIN "provider_surcharge" s ON s."provider" = p."provider"
        WHERE p."deletedAt" IS NULL
          AND p."isActive" = true
          AND p."destinationId" IS NOT NULL
        -- Compare cost WITH the supplier's tax / fee (#049); none = listed cost.
        ORDER BY p."destinationId", p."type", p."dataMb", p."durationDays",
          p."costPrice" * (1 + COALESCE(s."percentage", 0) / 100) ASC
      )
    `);

    // Mark cheapest plan per group (regionId, type, dataMb, durationDays)
    // For region plans
    await this.plansRepository.query(`
      UPDATE "plan" SET "isCheapest" = true
      WHERE id IN (
        SELECT DISTINCT ON (p."regionId", p."type", p."dataMb", p."durationDays") p.id
        FROM "plan" p
        LEFT JOIN "provider_surcharge" s ON s."provider" = p."provider"
        WHERE p."deletedAt" IS NULL
          AND p."isActive" = true
          AND p."regionId" IS NOT NULL
        -- Compare cost WITH the supplier's tax / fee (#049); none = listed cost.
        ORDER BY p."regionId", p."type", p."dataMb", p."durationDays",
          p."costPrice" * (1 + COALESCE(s."percentage", 0) / 100) ASC
      )
    `);
  }

  /**
   * Units sold per plan, then totals per destination and region (#053).
   *
   * Recounted from completed items of paid orders rather than incremented
   * where an item completes: that happens in every provider integration and
   * webhook, and a refund or failed delivery would leave a counter wrong for
   * good. A recount simply drops those out. Only rows whose number changed are
   * written, and `updatedAt` is left alone.
   */
  async recalculateSoldCounts(): Promise<void> {
    const params = [
      [...COMPLETED_ORDER_ITEM_STATUSES],
      [...COMPLETED_ORDER_STATUSES],
    ];

    await this.plansRepository.manager.transaction(async (manager) => {
      await manager.query(
        `WITH sold AS (
          SELECT oi."planId" AS "planId", SUM(oi."quantity")::int AS "qty"
          FROM "order_item" oi
          INNER JOIN "order" o ON o."id" = oi."orderId"
          WHERE oi."status" = ANY($1) AND o."status" = ANY($2)
            AND o."deletedAt" IS NULL
          GROUP BY oi."planId"
        )
        UPDATE "plan" p SET "soldCount" = COALESCE(s."qty", 0)
        FROM "plan" p2
        LEFT JOIN sold s ON s."planId" = p2."id"
        WHERE p."id" = p2."id" AND p."soldCount" <> COALESCE(s."qty", 0)`,
        params,
      );

      for (const [table, key] of [
        ['destination', 'destinationId'],
        ['region', 'regionId'],
      ] as const) {
        await manager.query(
          `UPDATE "${table}" t SET "soldCount" = x."qty"
          FROM (
            SELECT t2."id", COALESCE(SUM(p."soldCount"), 0)::int AS "qty"
            FROM "${table}" t2
            LEFT JOIN "plan" p ON p."${key}" = t2."id"
            GROUP BY t2."id"
          ) x
          WHERE t."id" = x."id" AND t."soldCount" <> x."qty"`,
        );
      }
    });
  }

  async batchUpdateDiscount(ids: number[], discount: number): Promise<void> {
    await this.plansRepository.query(
      `UPDATE "plan" SET "discount" = $1 WHERE "id" = ANY($2) AND "deletedAt" IS NULL`,
      [discount, ids],
    );
  }

  async recalculatePricesByTiers(
    tiers: Array<{
      minVnd: number;
      maxVnd: number;
      percentage: number;
      fixedAmountVnd?: number;
    }>,
    exchangeRate?: number,
  ): Promise<void> {
    if (tiers.length === 0) {
      await this.plansRepository.query(
        `UPDATE "plan" SET "price" = ROUND(${EFFECTIVE_COST_SQL} * 100) / 100 WHERE "deletedAt" IS NULL`,
      );
      return;
    }
    const cost = EFFECTIVE_COST_SQL;

    const rate = exchangeRate || 25500;

    // Match tier based on cost in VND:
    // - isLocalInventory: costPrice is already VND
    // - others: costPrice * exchangeRate
    let caseExpr = 'CASE ';
    for (const tier of tiers) {
      const costVndExpr = `(CASE WHEN "isLocalInventory" = true THEN ${cost} ELSE ROUND(${cost} * ${rate}) END)`;
      const condition = `WHEN ${costVndExpr} >= ${tier.minVnd} AND ${costVndExpr} <= ${tier.maxVnd} THEN `;

      if (tier.fixedAmountVnd && tier.fixedAmountVnd > 0) {
        // Fixed amount: price = costPrice + fixedAmountVnd / rate (convert VND back to USD)
        // For isLocalInventory: price = costPrice + fixedAmountVnd
        caseExpr += `${condition}(CASE WHEN "isLocalInventory" = true THEN ${cost} + ${tier.fixedAmountVnd} ELSE ROUND((${cost} + ${tier.fixedAmountVnd} / ${rate}) * 100) / 100 END) `;
      } else {
        // Percentage: price = costPrice * (1 + percentage/100)
        const multiplier = 1 + tier.percentage / 100;
        caseExpr += `${condition}ROUND(${cost} * ${multiplier} * 100) / 100 `;
      }
    }
    caseExpr += `ELSE ROUND(${cost} * 100) / 100 END`;

    await this.plansRepository.query(
      `UPDATE "plan" SET "price" = ${caseExpr} WHERE "deletedAt" IS NULL`,
    );
  }

  /**
   * Keep both cross-currency columns in step with today's rate.
   *
   * `price` means dollars for API suppliers but VND for local inventory, so
   * `usdPrice` is maintained separately and is the only column safe to read as
   * dollars (#037).
   */
  /**
   * Unsold eSIMs per plan. "Unsold" means the same thing the fulfilment code
   * means by it: status `available`, not attached to an order item and not
   * owned by a customer — otherwise a plan would look in stock while every
   * eSIM behind it is already sold.
   */
  async countAvailableEsimsByPlanIds(
    planIds: number[],
  ): Promise<Record<number, LocalStockSummary>> {
    if (!planIds.length) return {};

    const rows: {
      planId: string | number;
      count: string | number;
      earliestExpiresAt: Date | string | null;
    }[] = await this.plansRepository.query(
      // An expired eSIM is not sellable stock (#021): delivery refuses it, so
      // counting it here made the storefront advertise stock it would then
      // fail to hand over.
      //
      // The earliest expiry comes back in the same pass (#070). It is the only
      // activation deadline that is true of whichever eSIM the customer happens
      // to be handed: stock imported in different batches expires on different
      // dates, so promising the latest would be a promise we cannot keep.
      `SELECT "planId", COUNT(*) AS count, MIN("expiresAt") AS "earliestExpiresAt"
           FROM "esim"
           WHERE "planId" = ANY($1)
             AND "status" = 'available'
             AND "orderItemId" IS NULL
             AND "userId" IS NULL
             AND "deletedAt" IS NULL
             AND ("expiresAt" IS NULL OR "expiresAt" >= now())
           GROUP BY "planId"`,
      [planIds],
    );

    return rows.reduce<Record<number, LocalStockSummary>>((acc, row) => {
      acc[Number(row.planId)] = {
        count: Number(row.count),
        earliestExpiresAt: row.earliestExpiresAt
          ? new Date(row.earliestExpiresAt)
          : null,
      };
      return acc;
    }, {});
  }

  /**
   * Fill the VND and USD figures for cost / price / retail on every plan (#009).
   *
   * Two families of supplier:
   *  • dollar-quoted (every API supplier) — `costPrice`/`price`/`retailPrice`
   *    are dollars, multiply for đồng;
   *  • đồng-quoted (Viettel and the other local inventory, uploaded by Excel,
   *    plus any supplier whose `currency` is VND) — divide for dollars.
   *
   * `isLocalInventory = true OR currency = 'VND'` on purpose: the previous
   * version keyed the two branches off different conditions (`currency != 'VND'`
   * vs `isLocalInventory = true`), so a non-local plan quoted in đồng matched
   * neither and kept a stale figure for both currencies.
   *
   * `$1::numeric` on every use: with a bare `$1` Postgres infers the parameter
   * as integer from the surrounding literal, so a real exchange rate
   * (25887.097637) was rejected and the whole method threw. The caller logs and
   * swallows that, which made the failure invisible.
   */
  async updateAllVndPrices(rate: number): Promise<void> {
    if (!(rate > 0)) return;

    const DONG_QUOTED = `("isLocalInventory" = true OR "currency" = 'VND')`;
    const DOLLAR_QUOTED = `("isLocalInventory" IS NOT TRUE AND "currency" <> 'VND')`;

    // Dollar-quoted: đồng is the derived side. Rounded to thousands, the way
    // prices are shown.
    await this.plansRepository.query(
      `UPDATE "plan" SET
         "vndPrice" = ROUND("price" * $1::numeric / 1000) * 1000,
         "vndCostPrice" = ROUND(${EFFECTIVE_COST_SQL} * $1::numeric / 1000) * 1000,
         "vndRetailPrice" = ROUND("retailPrice" * $1::numeric / 1000) * 1000,
         "usdPrice" = "price",
         "usdCostPrice" = ROUND(${EFFECTIVE_COST_SQL}::numeric, 2),
         "usdRetailPrice" = "retailPrice"
       WHERE "deletedAt" IS NULL AND ${DOLLAR_QUOTED}`,
      [rate],
    );

    // Đồng-quoted: dollars are the derived side. Without this, a Viettel plan
    // reported its đồng figure as dollars — a ~25,000x overstatement wherever a
    // total mixes suppliers.
    await this.plansRepository.query(
      `UPDATE "plan" SET
         "vndPrice" = ROUND("price" / 1000) * 1000,
         "vndCostPrice" = ROUND(${EFFECTIVE_COST_SQL}),
         "vndRetailPrice" = ROUND("retailPrice"),
         "usdPrice" = ROUND("price"::numeric / $1::numeric, 2),
         "usdCostPrice" = ROUND(${EFFECTIVE_COST_SQL}::numeric / $1::numeric, 2),
         "usdRetailPrice" = ROUND("retailPrice"::numeric / $1::numeric, 2)
       WHERE "deletedAt" IS NULL AND ${DONG_QUOTED}`,
      [rate],
    );
  }

  async remove(id: Plan['id']): Promise<void> {
    await this.plansRepository.softDelete(id);
  }

  async getDistinctApns(): Promise<string[]> {
    const rows: { apn: string }[] = await this.plansRepository.query(
      `SELECT DISTINCT "apn" FROM "plan"
       WHERE "deletedAt" IS NULL AND "apn" IS NOT NULL AND btrim("apn") <> ''
       ORDER BY "apn"`,
    );
    return rows.map((row) => row.apn);
  }

  async getDistinctProvidersByDestinationId(
    destinationId: number,
  ): Promise<string[]> {
    const rows: { provider: string }[] = await this.plansRepository.query(
      `SELECT DISTINCT "provider" FROM "plan" WHERE "destinationId" = $1 AND "isActive" = true AND "deletedAt" IS NULL ORDER BY "provider"`,
      [destinationId],
    );
    return rows.map((r) => r.provider);
  }

  async getDistinctProvidersByRegionId(regionId: number): Promise<string[]> {
    const rows: { provider: string }[] = await this.plansRepository.query(
      `SELECT DISTINCT "provider" FROM "plan" WHERE "regionId" = $1 AND "isActive" = true AND "deletedAt" IS NULL ORDER BY "provider"`,
      [regionId],
    );
    return rows.map((r) => r.provider);
  }

  /**
   * List local-inventory carriers (one row per `provider`) for the domestic
   * eSIM tab. `fromVndPrice` is the cheapest plan price for that carrier so the
   * card can show "Từ {n}đ". Ordered by cheapest carrier first.
   */
  async getLocalCarriers(): Promise<
    { provider: string; fromVndPrice: number; planCount: number }[]
  > {
    const rows: {
      provider: string;
      fromVndPrice: string | number;
      planCount: string | number;
    }[] = await this.plansRepository.query(
      `SELECT "provider" AS provider, MIN("vndPrice") AS "fromVndPrice", COUNT(*)::int AS "planCount"
       FROM "plan"
       WHERE "isDomesticEsim" = true AND "isActive" = true AND "deletedAt" IS NULL
       GROUP BY "provider"
       ORDER BY MIN("vndPrice") ASC`,
    );
    return rows.map((r) => ({
      provider: r.provider,
      fromVndPrice: Number(r.fromVndPrice) || 0,
      planCount: Number(r.planCount) || 0,
    }));
  }

  async deactivateStaleProviderPlans(
    provider: string,
    syncStartedAt: Date,
  ): Promise<void> {
    await this.plansRepository.query(
      `UPDATE "plan" SET "isActive" = false WHERE "provider" = $1 AND "deletedAt" IS NULL AND "lastSyncedAt" IS NOT NULL AND "lastSyncedAt" < $2`,
      [provider, syncStartedAt],
    );
  }

  async deactivateAllProviderPlans(provider: string): Promise<void> {
    await this.plansRepository.query(
      `UPDATE "plan" SET "isActive" = false WHERE "provider" = $1 AND "deletedAt" IS NULL`,
      [provider],
    );
  }

  async findAllForExport(
    filterOptions?: FilterPlanDto | null,
  ): Promise<Plan[]> {
    const qb = this.plansRepository
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.destination', 'dest')
      .leftJoinAndSelect('plan.region', 'region')
      .leftJoin('region.destinations', 'regionDest')
      .leftJoin('destination', 'child', 'child."parentId" = dest.id');

    if (filterOptions?.search) {
      qb.where(
        '(plan.name ILIKE :search OR plan."countryCode" ILIKE :search OR dest.name ILIKE :search OR dest."keySearch" ILIKE :search OR dest."countryCode" ILIKE :search OR child.name ILIKE :search OR child."keySearch" ILIKE :search OR child."countryCode" ILIKE :search OR region.name ILIKE :search OR region.slug ILIKE :search OR regionDest.name ILIKE :search OR regionDest.keySearch ILIKE :search OR regionDest.countryCode ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );
    }

    if (filterOptions?.isCheapest !== undefined) {
      qb.andWhere('plan."isCheapest" = :isCheapest', {
        isCheapest: filterOptions.isCheapest,
      });
    }
    if (filterOptions?.isActive !== undefined) {
      qb.andWhere('plan."isActive" = :isActive', {
        isActive: filterOptions.isActive,
      });
    }
    if (filterOptions?.destinationId !== undefined) {
      qb.andWhere('plan."destinationId" = :destinationId', {
        destinationId: filterOptions.destinationId,
      });
    }
    if (filterOptions?.regionId !== undefined) {
      qb.andWhere('plan."regionId" = :regionId', {
        regionId: filterOptions.regionId,
      });
    }
    if (filterOptions?.provider?.length) {
      qb.andWhere('plan."provider" IN (:...providers)', {
        providers: filterOptions.provider,
      });
    }
    this.applyLocationAndCallSmsFilters(qb, filterOptions);
    if (filterOptions?.duration !== undefined) {
      qb.andWhere('plan."durationDays" = :duration', {
        duration: filterOptions.duration,
      });
    }
    if (filterOptions?.type) {
      qb.andWhere('plan."type" = :planType', {
        planType: filterOptions.type,
      });
    }
    if (filterOptions?.data) {
      const dataMb = this.parseDataToMb(filterOptions.data);
      if (dataMb > 0) {
        qb.andWhere('plan."dataMb" = :dataMb', { dataMb });
      }
    }
    if (filterOptions?.tags?.length) {
      qb.andWhere('plan."tags" @> :tags', {
        tags: JSON.stringify(filterOptions.tags),
      });
    }

    qb.orderBy('plan.createdAt', 'DESC');

    const entities = await qb.getMany();
    return entities.map((entity) => PlanMapper.toDomain(entity));
  }

  /**
   * Filters that are plain columns on `plan`.
   *
   * Extracted because the three query paths in `findManyWithPagination` each had
   * their own copy: that is how the two halves of the price conversion drifted
   * apart in #009, and a new filter added to two of three branches would be
   * silently ignored on the third.
   */
  private applyColumnFilters(
    qb: SelectQueryBuilder<PlanEntity>,
    f?: FilterPlanDto | null,
  ): void {
    if (f?.isCheapest !== undefined) {
      qb.andWhere('plan."isCheapest" = :isCheapest', {
        isCheapest: f.isCheapest,
      });
    }
    if (f?.isActive !== undefined) {
      qb.andWhere('plan."isActive" = :isActive', { isActive: f.isActive });
    }
    if (f?.isDomesticEsim !== undefined) {
      qb.andWhere('plan."isDomesticEsim" = :isDomesticEsim', {
        isDomesticEsim: f.isDomesticEsim,
      });
    }
    if (f?.isLocalInventory !== undefined) {
      qb.andWhere('plan."isLocalInventory" = :isLocalInventory', {
        isLocalInventory: f.isLocalInventory,
      });
    }
    if (f?.destinationId !== undefined) {
      qb.andWhere('plan."destinationId" = :destinationId', {
        destinationId: f.destinationId,
      });
    }
    if (f?.regionId !== undefined) {
      qb.andWhere('plan."regionId" = :regionId', { regionId: f.regionId });
    }
    if (f?.provider?.length) {
      qb.andWhere('plan."provider" IN (:...providers)', {
        providers: f.provider,
      });
    }
    // #010 — APN is matched exactly: it is picked from a select box of the
    // distinct values, not typed.
    if (f?.apn) {
      qb.andWhere('plan."apn" = :apn', { apn: f.apn });
    }
    if (f?.isNonHkIp !== undefined) {
      qb.andWhere('COALESCE(plan."isNonHkIp", false) = :isNonHkIp', {
        isNonHkIp: f.isNonHkIp,
      });
    }
    if (f?.topUp !== undefined) {
      qb.andWhere('COALESCE(plan."topUp", false) = :topUp', { topUp: f.topUp });
    }
  }

  private applyLocationAndCallSmsFilters(
    qb: SelectQueryBuilder<PlanEntity>,
    filterOptions?: FilterPlanDto | null,
  ): void {
    if (filterOptions?.country) {
      qb.andWhere(
        '(plan."countryCode" ILIKE :country OR dest."countryCode" ILIKE :country OR dest.name ILIKE :country OR dest."keySearch" ILIKE :country OR child."countryCode" ILIKE :country OR child.name ILIKE :country OR child."keySearch" ILIKE :country OR region.name ILIKE :country OR region.slug ILIKE :country OR regionDest.countryCode ILIKE :country OR regionDest.name ILIKE :country OR regionDest.keySearch ILIKE :country)',
        { country: `%${filterOptions.country}%` },
      );
    }

    if (filterOptions?.hasCallSms === true) {
      qb.andWhere('(COALESCE(plan.sms, 0) > 0 OR COALESCE(plan.call, 0) > 0)');
    } else if (filterOptions?.hasCallSms === false) {
      qb.andWhere(
        '(COALESCE(plan.sms, 0) <= 0 AND COALESCE(plan.call, 0) <= 0)',
      );
    }
  }

  private parseDataToMb(dataStr: string): number {
    const match = dataStr.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|TB)$/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    switch (unit) {
      case 'TB':
        return value * 1024 * 1024;
      case 'GB':
        return value * 1024;
      case 'MB':
        return value;
      default:
        return 0;
    }
  }
}
