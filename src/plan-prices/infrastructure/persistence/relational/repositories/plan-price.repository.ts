import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PlanPriceEntity } from '../entities/plan-price.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterPlanPriceDto,
  SortPlanPriceDto,
} from '../../../../dto/query-plan-price.dto';
import { PlanPrice } from '../../../../domain/plan-price';
import { PlanPriceRepository } from '../../plan-price.repository';
import { PlanPriceMapper } from '../mappers/plan-price.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class PlanPricesRelationalRepository implements PlanPriceRepository {
  constructor(
    @InjectRepository(PlanPriceEntity)
    private readonly planPricesRepository: Repository<PlanPriceEntity>,
  ) {}

  async create(data: PlanPrice): Promise<PlanPrice> {
    const persistenceModel = PlanPriceMapper.toPersistence(data);
    const newEntity = await this.planPricesRepository.save(
      this.planPricesRepository.create(persistenceModel),
    );
    return PlanPriceMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterPlanPriceDto | null;
    sortOptions?: SortPlanPriceDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[PlanPrice[], number]> {
    const where: FindOptionsWhere<PlanPriceEntity> = {};

    if (filterOptions?.isActive !== undefined) {
      where.isActive = filterOptions.isActive;
    }
    if (filterOptions?.planId !== undefined) {
      where.planId = filterOptions.planId;
    }

    const [entities, count] = await this.planPricesRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where: where,
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

    return [entities.map((entity) => PlanPriceMapper.toDomain(entity)), count];
  }

  async findById(id: PlanPrice['id']): Promise<NullableType<PlanPrice>> {
    const entity = await this.planPricesRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? PlanPriceMapper.toDomain(entity) : null;
  }

  async findByPlanIdAndCurrency(
    planId: PlanPrice['planId'],
    currency: PlanPrice['currency'],
  ): Promise<NullableType<PlanPrice>> {
    const entity = await this.planPricesRepository.findOne({
      where: { planId, currency },
    });

    return entity ? PlanPriceMapper.toDomain(entity) : null;
  }

  async update(
    id: PlanPrice['id'],
    payload: Partial<PlanPrice>,
  ): Promise<PlanPrice> {
    const entity = await this.planPricesRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('PlanPrice not found');
    }

    const updatedEntity = await this.planPricesRepository.save(
      this.planPricesRepository.create(
        PlanPriceMapper.toPersistence({
          ...PlanPriceMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return PlanPriceMapper.toDomain(updatedEntity);
  }

  async remove(id: PlanPrice['id']): Promise<void> {
    await this.planPricesRepository.softDelete(id);
  }
}
