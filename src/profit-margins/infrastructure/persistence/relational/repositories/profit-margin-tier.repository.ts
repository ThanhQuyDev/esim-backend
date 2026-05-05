import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ProfitMarginTierEntity } from '../entities/profit-margin-tier.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterProfitMarginTierDto,
  SortProfitMarginTierDto,
} from '../../../../dto/query-profit-margin-tier.dto';
import { ProfitMarginTier } from '../../../../domain/profit-margin-tier';
import { ProfitMarginTierRepository } from '../../profit-margin-tier.repository';
import { ProfitMarginTierMapper } from '../mappers/profit-margin-tier.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ProfitMarginTiersRelationalRepository implements ProfitMarginTierRepository {
  constructor(
    @InjectRepository(ProfitMarginTierEntity)
    private readonly tiersRepository: Repository<ProfitMarginTierEntity>,
  ) {}

  async create(data: ProfitMarginTier): Promise<ProfitMarginTier> {
    const persistenceModel = ProfitMarginTierMapper.toPersistence(data);
    const newEntity = await this.tiersRepository.save(
      this.tiersRepository.create(persistenceModel),
    );
    return ProfitMarginTierMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProfitMarginTierDto | null;
    sortOptions?: SortProfitMarginTierDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<ProfitMarginTier[]> {
    const where: FindOptionsWhere<ProfitMarginTierEntity> = {};

    if (filterOptions?.isActive !== undefined) {
      where.isActive = filterOptions.isActive;
    }

    const entities = await this.tiersRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.length
        ? sortOptions.reduce(
            (acc, sort) => ({ ...acc, [sort.orderBy]: sort.order }),
            {},
          )
        : { minVnd: 'ASC' },
    });

    return entities.map((entity) => ProfitMarginTierMapper.toDomain(entity));
  }

  async findAll(): Promise<ProfitMarginTier[]> {
    const entities = await this.tiersRepository.find({
      where: { isActive: true },
      order: { minVnd: 'ASC' },
    });
    return entities.map((entity) => ProfitMarginTierMapper.toDomain(entity));
  }

  async findById(
    id: ProfitMarginTier['id'],
  ): Promise<NullableType<ProfitMarginTier>> {
    const entity = await this.tiersRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? ProfitMarginTierMapper.toDomain(entity) : null;
  }

  async update(
    id: ProfitMarginTier['id'],
    payload: Partial<ProfitMarginTier>,
  ): Promise<ProfitMarginTier> {
    const entity = await this.tiersRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('ProfitMarginTier not found');
    }

    const updatedEntity = await this.tiersRepository.save(
      this.tiersRepository.create(
        ProfitMarginTierMapper.toPersistence({
          ...ProfitMarginTierMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ProfitMarginTierMapper.toDomain(updatedEntity);
  }

  async remove(id: ProfitMarginTier['id']): Promise<void> {
    await this.tiersRepository.softDelete(id);
  }

  async findOverlapping(
    minVnd: number,
    maxVnd: number,
    excludeId?: number,
  ): Promise<ProfitMarginTier[]> {
    const qb = this.tiersRepository
      .createQueryBuilder('tier')
      .where('tier.deletedAt IS NULL')
      .andWhere('tier.minVnd <= :maxVnd', { maxVnd })
      .andWhere('tier.maxVnd >= :minVnd', { minVnd });

    if (excludeId) {
      qb.andWhere('tier.id != :excludeId', { excludeId });
    }

    const entities = await qb.getMany();
    return entities.map((entity) => ProfitMarginTierMapper.toDomain(entity));
  }
}
