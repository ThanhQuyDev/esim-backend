import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PlanEntity } from '../entities/plan.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterPlanDto, SortPlanDto } from '../../../../dto/query-plan.dto';
import { Plan } from '../../../../domain/plan';
import { PlanRepository } from '../../plan.repository';
import { PlanMapper } from '../mappers/plan.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

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
  }): Promise<Plan[]> {
    if (filterOptions?.search) {
      const qb = this.plansRepository
        .createQueryBuilder('plan')
        .leftJoinAndSelect('plan.destination', 'dest')
        .leftJoin('destination', 'child', 'child."parentId" = dest.id');

      qb.where(
        '(plan.name ILIKE :search OR dest.name ILIKE :search OR dest."keySearch" ILIKE :search OR child.name ILIKE :search OR child."keySearch" ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );

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

      const entities = await qb.getMany();
      return entities.map((entity) => PlanMapper.toDomain(entity));
    }

    const where: FindOptionsWhere<PlanEntity> = {};

    if (filterOptions?.isCheapest !== undefined) {
      where.isCheapest = filterOptions.isCheapest;
    }
    if (filterOptions?.isActive !== undefined) {
      where.isActive = filterOptions.isActive;
    }
    if (filterOptions?.destinationId !== undefined) {
      where.destinationId = filterOptions.destinationId as any;
    }
    if (filterOptions?.regionId !== undefined) {
      where.regionId = filterOptions.regionId as any;
    }

    const entities = await this.plansRepository.find({
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

    return entities.map((entity) => PlanMapper.toDomain(entity));
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
        SELECT DISTINCT ON ("destinationId", "type", "dataMb", "durationDays") id
        FROM "plan"
        WHERE "deletedAt" IS NULL
          AND "isActive" = true
          AND "destinationId" IS NOT NULL
        ORDER BY "destinationId", "type", "dataMb", "durationDays", "costPrice" ASC
      )
    `);

    // Mark cheapest plan per group (regionId, type, dataMb, durationDays)
    // For region plans
    await this.plansRepository.query(`
      UPDATE "plan" SET "isCheapest" = true
      WHERE id IN (
        SELECT DISTINCT ON ("regionId", "type", "dataMb", "durationDays") id
        FROM "plan"
        WHERE "deletedAt" IS NULL
          AND "isActive" = true
          AND "regionId" IS NOT NULL
        ORDER BY "regionId", "type", "dataMb", "durationDays", "costPrice" ASC
      )
    `);
  }

  async batchUpdateDiscount(ids: number[], discount: number): Promise<void> {
    await this.plansRepository.query(
      `UPDATE "plan" SET "discount" = $1 WHERE "id" = ANY($2) AND "deletedAt" IS NULL`,
      [discount, ids],
    );
  }

  async recalculatePricesByTiers(
    tiers: Array<{ minVnd: number; maxVnd: number; percentage: number }>,
  ): Promise<void> {
    if (tiers.length === 0) {
      // No tiers configured — set price = costPrice (no profit)
      await this.plansRepository.query(
        `UPDATE "plan" SET "price" = "costPrice" WHERE "deletedAt" IS NULL`,
      );
      return;
    }

    // Build CASE expression for tiered pricing
    // For each tier: WHEN vndPrice BETWEEN minVnd AND maxVnd THEN costPrice * (1 + percentage/100)
    let caseExpr = 'CASE ';
    for (const tier of tiers) {
      const multiplier = 1 + tier.percentage / 100;
      caseExpr += `WHEN "vndPrice" >= ${tier.minVnd} AND "vndPrice" <= ${tier.maxVnd} THEN ROUND("costPrice" * ${multiplier} * 100) / 100 `;
    }
    caseExpr += 'ELSE "costPrice" END';

    await this.plansRepository.query(
      `UPDATE "plan" SET "price" = ${caseExpr} WHERE "deletedAt" IS NULL`,
    );
  }

  async updateAllVndPrices(rate: number): Promise<void> {
    await this.plansRepository.query(
      `UPDATE "plan" SET "vndPrice" = ROUND("retailPrice" * $1 / 1000) * 1000 WHERE "deletedAt" IS NULL AND "currency" != 'VND'`,
      [rate],
    );
  }

  async remove(id: Plan['id']): Promise<void> {
    await this.plansRepository.softDelete(id);
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
}
