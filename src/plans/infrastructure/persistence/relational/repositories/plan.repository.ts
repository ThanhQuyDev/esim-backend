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
    const where: FindOptionsWhere<PlanEntity> = {};

    if (filterOptions?.isActive !== undefined) {
      where.isActive = filterOptions.isActive;
    }
    if (filterOptions?.destinationId !== undefined) {
      where.destinationId = filterOptions.destinationId;
    }

    const entities = await this.plansRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where: where,
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

  async remove(id: Plan['id']): Promise<void> {
    await this.plansRepository.softDelete(id);
  }
}
