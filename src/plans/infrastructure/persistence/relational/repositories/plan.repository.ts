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
      order: sortOptions?.reduce(
        (accumulator, sort) => ({
          ...accumulator,
          [sort.orderBy]: sort.order,
        }),
        {},
      ),
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

    // Mark cheapest plan per group (destinationId, type, dataGb, durationDays)
    // Only for plans with a destinationId (single-country plans)
    await this.plansRepository.query(`
      UPDATE "plan" SET "isCheapest" = true
      WHERE id IN (
        SELECT DISTINCT ON ("destinationId", "type", "dataGb", "durationDays") id
        FROM "plan"
        WHERE "deletedAt" IS NULL
          AND "isActive" = true
          AND "destinationId" IS NOT NULL
        ORDER BY "destinationId", "type", "dataGb", "durationDays", "costPrice" ASC
      )
    `);

    // Mark cheapest plan per group (regionId, type, dataGb, durationDays)
    // For region plans
    await this.plansRepository.query(`
      UPDATE "plan" SET "isCheapest" = true
      WHERE id IN (
        SELECT DISTINCT ON ("regionId", "type", "dataGb", "durationDays") id
        FROM "plan"
        WHERE "deletedAt" IS NULL
          AND "isActive" = true
          AND "regionId" IS NOT NULL
        ORDER BY "regionId", "type", "dataGb", "durationDays", "costPrice" ASC
      )
    `);
  }

  async batchUpdateDiscount(ids: number[], discount: number): Promise<void> {
    await this.plansRepository.query(
      `UPDATE "plan" SET "discount" = $1 WHERE "id" = ANY($2) AND "deletedAt" IS NULL`,
      [discount, ids],
    );
  }

  async recalculatePrices(profitPercentage: number): Promise<void> {
    const multiplier = 1 + profitPercentage / 100;
    await this.plansRepository.query(
      `UPDATE "plan" SET "price" = ROUND("costPrice" * $1 * 100) / 100 WHERE "deletedAt" IS NULL`,
      [multiplier],
    );
  }

  async updateAllVndPrices(rate: number): Promise<void> {
    await this.plansRepository.query(
      `UPDATE "plan" SET "vndPrice" = ROUND("retailPrice" * $1 / 1000) * 1000 WHERE "deletedAt" IS NULL`,
      [rate],
    );
  }

  async remove(id: Plan['id']): Promise<void> {
    await this.plansRepository.softDelete(id);
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
