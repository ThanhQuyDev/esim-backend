import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ProfitMarginEntity } from '../entities/profit-margin.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterProfitMarginDto,
  SortProfitMarginDto,
} from '../../../../dto/query-profit-margin.dto';
import { ProfitMargin } from '../../../../domain/profit-margin';
import { ProfitMarginRepository } from '../../profit-margin.repository';
import { ProfitMarginMapper } from '../mappers/profit-margin.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ProfitMarginsRelationalRepository implements ProfitMarginRepository {
  constructor(
    @InjectRepository(ProfitMarginEntity)
    private readonly profitMarginsRepository: Repository<ProfitMarginEntity>,
  ) {}

  async create(data: ProfitMargin): Promise<ProfitMargin> {
    const persistenceModel = ProfitMarginMapper.toPersistence(data);
    const newEntity = await this.profitMarginsRepository.save(
      this.profitMarginsRepository.create(persistenceModel),
    );
    return ProfitMarginMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProfitMarginDto | null;
    sortOptions?: SortProfitMarginDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<ProfitMargin[]> {
    const where: FindOptionsWhere<ProfitMarginEntity> = {};

    if (filterOptions?.isActive !== undefined) {
      where.isActive = filterOptions.isActive;
    }

    const entities = await this.profitMarginsRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.length
        ? sortOptions.reduce(
            (acc, sort) => ({ ...acc, [sort.orderBy]: sort.order }),
            {},
          )
        : { createdAt: 'DESC' },
    });

    return entities.map((entity) => ProfitMarginMapper.toDomain(entity));
  }

  async findById(id: ProfitMargin['id']): Promise<NullableType<ProfitMargin>> {
    const entity = await this.profitMarginsRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? ProfitMarginMapper.toDomain(entity) : null;
  }

  async update(
    id: ProfitMargin['id'],
    payload: Partial<ProfitMargin>,
  ): Promise<ProfitMargin> {
    const entity = await this.profitMarginsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('ProfitMargin not found');
    }

    const updatedEntity = await this.profitMarginsRepository.save(
      this.profitMarginsRepository.create(
        ProfitMarginMapper.toPersistence({
          ...ProfitMarginMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ProfitMarginMapper.toDomain(updatedEntity);
  }

  async remove(id: ProfitMargin['id']): Promise<void> {
    await this.profitMarginsRepository.softDelete(id);
  }
}
