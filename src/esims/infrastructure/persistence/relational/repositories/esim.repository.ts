import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EsimEntity } from '../entities/esim.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterEsimDto, SortEsimDto } from '../../../../dto/query-esim.dto';
import { Esim } from '../../../../domain/esim';
import { EsimRepository, EsimTopupSummary } from '../../esim.repository';
import { EsimMapper } from '../mappers/esim.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { ESIM_LIFECYCLE_SQL } from '../../../../esim-lifecycle';

@Injectable()
export class EsimsRelationalRepository implements EsimRepository {
  constructor(
    @InjectRepository(EsimEntity)
    private readonly esimsRepository: Repository<EsimEntity>,
  ) {}

  async create(data: Esim): Promise<Esim> {
    const persistenceModel = EsimMapper.toPersistence(data);
    const newEntity = await this.esimsRepository.save(
      this.esimsRepository.create(persistenceModel),
    );
    return EsimMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterEsimDto | null;
    sortOptions?: SortEsimDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Esim[], number]> {
    const qb = this.esimsRepository
      .createQueryBuilder('esim')
      .leftJoinAndSelect('esim.plan', 'plan')
      .leftJoinAndSelect('plan.destination', 'destination')
      .leftJoinAndSelect('plan.region', 'region');

    this.applyEsimFilters(qb, filterOptions);

    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(`esim.${sort.orderBy}`, sort.order as 'ASC' | 'DESC');
      });
    } else {
      qb.orderBy('esim.createdAt', 'DESC');
    }

    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();

    return [entities.map((entity) => EsimMapper.toDomain(entity)), count];
  }

  /**
   * Every filter the eSIM list understands.
   *
   * Shared with the Excel export so the file matches the screen (#027): the
   * export applied four of them and silently ignored the six added in #020, so
   * filtering by supplier and exporting handed back the whole table.
   */
  private applyEsimFilters(
    qb: SelectQueryBuilder<EsimEntity>,
    filterOptions?: FilterEsimDto | null,
  ): void {
    if (filterOptions?.status && filterOptions.includeAll) {
      // The admin list filters on the lifecycle status it shows, and takes
      // several at once — picking two used to drop the filter (#024).
      const statuses = Array.isArray(filterOptions.status)
        ? filterOptions.status
        : [filterOptions.status];
      qb.andWhere(`${ESIM_LIFECYCLE_SQL} IN (:...lifecycleStatuses)`, {
        lifecycleStatuses: statuses,
      });
    } else if (filterOptions?.status) {
      const statuses = Array.isArray(filterOptions.status)
        ? filterOptions.status
        : [filterOptions.status];
      qb.andWhere('esim.status IN (:...statuses)', { statuses });
    } else if (!filterOptions?.includeAll) {
      qb.andWhere('esim.status != :refundedStatus', {
        refundedStatus: 'refunded',
      });
    }
    if (filterOptions?.userId !== undefined) {
      qb.andWhere('esim.userId = :userId', { userId: filterOptions.userId });
    }
    if (filterOptions?.search) {
      qb.andWhere(
        '(esim.iccid ILIKE :search OR esim.esimTranNo ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );
    }
    if (filterOptions?.planName) {
      qb.andWhere('plan.name ILIKE :planName', {
        planName: `%${filterOptions.planName}%`,
      });
    }

    // #020 — filters over the plan behind the eSIM and over its dates.
    if (filterOptions?.planType?.length) {
      qb.andWhere('plan.type IN (:...planTypes)', {
        planTypes: filterOptions.planType,
      });
    }
    if (filterOptions?.provider?.length) {
      // Local inventory carries the supplier on the plan, API providers on the
      // eSIM row itself — matching only one of them would miss half the rows.
      qb.andWhere('COALESCE(esim.provider, plan.provider) IN (:...providers)', {
        providers: filterOptions.provider,
      });
    }
    if (filterOptions?.hasCallSms === true) {
      qb.andWhere('(COALESCE(plan.sms, 0) > 0 OR COALESCE(plan.call, 0) > 0)');
    } else if (filterOptions?.hasCallSms === false) {
      qb.andWhere(
        '(COALESCE(plan.sms, 0) <= 0 AND COALESCE(plan.call, 0) <= 0)',
      );
    }
    if (filterOptions?.topUp !== undefined) {
      qb.andWhere('COALESCE(plan."topUp", false) = :topUp', {
        topUp: filterOptions.topUp,
      });
    }
    // A bare `to` date has to cover that whole day, so it compares against the
    // start of the next one — `<=` would drop everything dated that day.
    if (filterOptions?.createdFrom) {
      qb.andWhere('esim."createdAt" >= :createdFrom', {
        createdFrom: filterOptions.createdFrom,
      });
    }
    if (filterOptions?.createdTo) {
      qb.andWhere(`esim."createdAt" < (:createdTo::date + INTERVAL '1 day')`, {
        createdTo: filterOptions.createdTo,
      });
    }
    if (filterOptions?.expiresFrom) {
      qb.andWhere('esim."expiresAt" >= :expiresFrom', {
        expiresFrom: filterOptions.expiresFrom,
      });
    }
    if (filterOptions?.expiresTo) {
      qb.andWhere(`esim."expiresAt" < (:expiresTo::date + INTERVAL '1 day')`, {
        expiresTo: filterOptions.expiresTo,
      });
    }
  }

  async findById(id: Esim['id']): Promise<NullableType<Esim>> {
    const entity = await this.esimsRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? EsimMapper.toDomain(entity) : null;
  }

  async findByIdWithRelations(id: Esim['id']): Promise<NullableType<Esim>> {
    const entity = await this.esimsRepository.findOne({
      where: { id: Number(id) },
      relations: ['user', 'plan'],
    });
    return entity ? EsimMapper.toDomain(entity) : null;
  }

  async findByIccid(iccid: Esim['iccid']): Promise<NullableType<Esim>> {
    const entity = await this.esimsRepository.findOne({
      where: { iccid },
    });
    return entity ? EsimMapper.toDomain(entity) : null;
  }

  async findByIccidWithDeleted(
    iccid: Esim['iccid'],
  ): Promise<NullableType<Esim>> {
    const entity = await this.esimsRepository.findOne({
      where: { iccid },
      withDeleted: true,
    });
    return entity ? EsimMapper.toDomain(entity) : null;
  }

  async findByOrderItemIds(orderItemIds: number[]): Promise<Esim[]> {
    if (!orderItemIds.length) return [];
    const entities = await this.esimsRepository.find({
      where: orderItemIds.map((id) => ({ orderItemId: id })),
    });
    return entities.map(EsimMapper.toDomain);
  }

  /**
   * Mark all eSIMs belonging to a given order (via their order items) as
   * refunded. Used when an admin refunds the order — keeps eSIMs auditable
   * but flips their status so they no longer appear in user listings.
   */
  async markRefundedByOrderId(orderId: number): Promise<number> {
    const result = await this.esimsRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'refunded' })
      .where(
        'orderItemId IN (SELECT id FROM order_item WHERE "orderId" = :orderId)',
        { orderId },
      )
      .execute();
    return result.affected ?? 0;
  }

  async findAvailableByPlanId(planId: number, limit: number): Promise<Esim[]> {
    const entities = await this.esimsRepository
      .createQueryBuilder('esim')
      .where('esim."planId" = :planId', { planId })
      .andWhere(`esim.status = 'available'`)
      .andWhere('esim."orderItemId" IS NULL')
      .andWhere('esim."userId" IS NULL')
      // An eSIM past its expiry must never be handed to a customer (#021).
      // FEFO below made this worse than random: an expired eSIM sorts FIRST, so
      // the one delivered was the most expired one in stock.
      .andWhere('(esim."expiresAt" IS NULL OR esim."expiresAt" >= now())')
      // FEFO — sell the eSIM closest to expiry first to avoid stale stock
      // expiring unsold. eSIMs with no expiry (expiresAt = null) sort last,
      // falling back to FIFO by createdAt.
      .orderBy('esim."expiresAt"', 'ASC', 'NULLS LAST')
      .addOrderBy('esim."createdAt"', 'ASC')
      .take(limit)
      .getMany();
    return entities.map(EsimMapper.toDomain);
  }

  /**
   * How many times each of these eSIMs has been topped up, and when last (#025).
   *
   * Derived from the orders rather than a flag on the eSIM: a topup IS a paid
   * TOPUP order against the ICCID, so this is right for eSIMs topped up before
   * any flag existed and cannot drift out of step with the orders.
   *
   * Only paid orders count — a pending or failed topup added nothing.
   */
  async findOrderNumbersByOrderItemIds(
    orderItemIds: number[],
  ): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    if (!orderItemIds.length) return result;
    const rows: { id: number; orderNumber: string }[] =
      await this.esimsRepository.query(
        `SELECT oi.id, o."orderNumber"
           FROM "order_item" oi
           JOIN "order" o ON o.id = oi."orderId"
          WHERE oi.id = ANY($1::int[])`,
        [orderItemIds],
      );
    for (const row of rows) result.set(Number(row.id), row.orderNumber);
    return result;
  }

  async countTopupsByIccids(
    iccids: string[],
  ): Promise<Map<string, EsimTopupSummary>> {
    const result = new Map<string, EsimTopupSummary>();
    if (!iccids.length) return result;

    const rows: {
      iccid: string;
      count: string | number;
      lastAt: Date | null;
      vndPrice: string | number | null;
      vndCostPrice: string | number | null;
      packageNames: string | null;
    }[] = await this.esimsRepository.query(
      // The sums are what the export reconciles on (#027): an eSIM can be topped
      // up several times and each one cost money of its own.
      `SELECT "targetIccid" AS iccid,
              COUNT(*) AS count,
              MAX("createdAt") AS "lastAt",
              SUM("vndPrice") AS "vndPrice",
              SUM("vndCostPrice") AS "vndCostPrice",
              STRING_AGG(
                COALESCE(NULLIF("topupPackageName", ''), "topupPackageId"),
                ', ' ORDER BY "createdAt" DESC
              ) AS "packageNames"
         FROM "order"
        WHERE "targetIccid" = ANY($1)
          AND "orderType" = 'TOPUP'
          -- A topup that went through ends as "completed" — "paid" only means
          -- the money is in and the provider call is still to come. Counting
          -- "paid" alone left every successful topup unmarked (#026, round 4).
          AND "status" IN ('paid', 'completed')
          AND "deletedAt" IS NULL
        GROUP BY "targetIccid"`,
      [iccids],
    );

    for (const row of rows) {
      result.set(row.iccid, {
        count: Number(row.count) || 0,
        lastAt: row.lastAt ?? null,
        vndPrice: Number(row.vndPrice) || 0,
        vndCostPrice: Number(row.vndCostPrice) || 0,
        packageNames: row.packageNames ?? null,
      });
    }
    return result;
  }

  /**
   * Every topup applied to one eSIM, newest first (#026).
   *
   * Reads the snapshot the topup order stored at checkout (#015) rather than
   * asking the provider now: the package may have been withdrawn or repriced, and
   * the eSIM detail has to report the deal that was actually bought.
   */
  async findTopupsByIccid(iccid: string): Promise<
    {
      orderId: number;
      orderNumber: string;
      packageId: string | null;
      packageName: string | null;
      dataText: string | null;
      durationDays: number | null;
      isUnlimited: boolean;
      vndPrice: number;
      vndCostPrice: number;
      provider: string | null;
      createdAt: Date;
    }[]
  > {
    if (!iccid) return [];
    const rows: Record<string, unknown>[] = await this.esimsRepository.query(
      `SELECT "id" AS "orderId", "orderNumber", "topupPackageId" AS "packageId",
              "topupPackageName" AS "packageName", "topupDataText" AS "dataText",
              "topupDurationDays" AS "durationDays",
              "topupIsUnlimited" AS "isUnlimited",
              "vndPrice", "vndCostPrice", "topupProvider" AS "provider",
              "createdAt"
         FROM "order"
        WHERE "targetIccid" = $1
          AND "orderType" = 'TOPUP'
          -- A topup that went through ends as "completed" — "paid" only means
          -- the money is in and the provider call is still to come. Counting
          -- "paid" alone left every successful topup unmarked (#026, round 4).
          AND "status" IN ('paid', 'completed')
          AND "deletedAt" IS NULL
        ORDER BY "createdAt" DESC`,
      [iccid],
    );

    return rows.map((row) => ({
      orderId: Number(row.orderId),
      orderNumber: String(row.orderNumber ?? ''),
      packageId: (row.packageId as string) ?? null,
      packageName: (row.packageName as string) ?? null,
      dataText: (row.dataText as string) ?? null,
      durationDays:
        row.durationDays == null ? null : Number(row.durationDays) || null,
      isUnlimited: !!row.isUnlimited,
      vndPrice: Number(row.vndPrice) || 0,
      vndCostPrice: Number(row.vndCostPrice) || 0,
      provider: (row.provider as string) ?? null,
      createdAt: row.createdAt as Date,
    }));
  }

  /**
   * Unsold local-inventory eSIMs whose expiry has already passed (#021).
   *
   * They are dead stock: delivery skips them, so they have to be visible to an
   * admin instead of silently padding the stock figure.
   */
  async countExpiredAvailableByPlanIds(
    planIds: number[],
  ): Promise<Record<number, number>> {
    if (!planIds.length) return {};
    const rows: { planId: string | number; count: string | number }[] =
      await this.esimsRepository.query(
        `SELECT "planId", COUNT(*) AS count FROM "esim"
           WHERE "planId" = ANY($1)
             AND "status" = 'available'
             AND "orderItemId" IS NULL
             AND "userId" IS NULL
             AND "deletedAt" IS NULL
             AND "expiresAt" IS NOT NULL
             AND "expiresAt" < now()
           GROUP BY "planId"`,
        [planIds],
      );
    return rows.reduce<Record<number, number>>((acc, row) => {
      acc[Number(row.planId)] = Number(row.count);
      return acc;
    }, {});
  }

  async update(id: Esim['id'], payload: Partial<Esim>): Promise<Esim> {
    const entity = await this.esimsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Esim not found');
    }

    const updatedEntity = await this.esimsRepository.save(
      this.esimsRepository.create(
        EsimMapper.toPersistence({
          ...EsimMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return EsimMapper.toDomain(updatedEntity);
  }

  async remove(id: Esim['id']): Promise<void> {
    await this.esimsRepository.softDelete(id);
  }

  async removeMany(ids: Esim['id'][]): Promise<number> {
    if (!ids.length) return 0;
    const result = await this.esimsRepository.softDelete(ids as number[]);
    return result.affected ?? 0;
  }

  async restore(id: Esim['id']): Promise<void> {
    await this.esimsRepository.restore(id);
  }

  /**
   * Soft-delete rows of `status` whose timestamp is older than
   * `olderThanDays`. The cutoff is computed by Postgres (LOCALTIMESTAMP), not
   * in Node: the timestamp columns are `timestamp without time zone` written
   * by the DB's own clock, so passing a JS Date makes the driver serialize it
   * in the app server's timezone and skews the window by the whole UTC offset.
   */
  async softDeleteByStatusOlderThan(
    status: string,
    olderThanDays: number,
  ): Promise<number> {
    const result = await this.esimsRepository
      .createQueryBuilder()
      .softDelete()
      .where('status = :status', { status })
      // Quoted: an unquoted identifier is folded to lowercase by Postgres, so
      // `updatedAt` would look for a non-existent `updatedat` column.
      .andWhere(
        `"updatedAt" < LOCALTIMESTAMP - (:olderThanDays * INTERVAL '1 day')`,
        { olderThanDays },
      )
      .andWhere('"deletedAt" IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  /**
   * eSIMs the usage cron should ask the provider about.
   *
   * Ordered by `updatedAt` ascending so the stalest rows go first: with a
   * per-run cap, every eSIM still comes round eventually instead of the same
   * few being refreshed forever.
   */
  async findDueForUsageRefresh(
    providers: string[],
    limit: number,
  ): Promise<Esim[]> {
    if (!providers.length) return [];

    const entities = await this.esimsRepository
      .createQueryBuilder('esim')
      .where('esim.provider IN (:...providers)', { providers })
      .andWhere('esim.status IN (:...statuses)', {
        statuses: ['sold', 'active'],
      })
      // An expired eSIM cannot use any more data, so stop polling it.
      .andWhere('(esim."expiresAt" IS NULL OR esim."expiresAt" > NOW())')
      .orderBy('esim.updatedAt', 'ASC')
      .limit(limit)
      .getMany();

    return entities.map((entity) => EsimMapper.toDomain(entity));
  }

  async findAllForExport(
    filterOptions?: FilterEsimDto | null,
  ): Promise<Esim[]> {
    const qb = this.esimsRepository
      .createQueryBuilder('esim')
      .leftJoinAndSelect('esim.plan', 'plan');

    // The same filters the list applies, so the file matches the screen (#027).
    this.applyEsimFilters(qb, filterOptions);

    qb.orderBy('esim.createdAt', 'DESC');

    const entities = await qb.getMany();
    return entities.map((entity) => EsimMapper.toDomain(entity));
  }
}
