import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { SeoConfigEntity } from '../entities/seo-config.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterSeoConfigDto,
  SortSeoConfigDto,
} from '../../../../dto/query-seo-config.dto';
import { SeoConfig } from '../../../../domain/seo-config';
import { SeoConfigRepository } from '../../seo-config.repository';
import { SeoConfigMapper } from '../mappers/seo-config.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class SeoConfigsRelationalRepository implements SeoConfigRepository {
  constructor(
    @InjectRepository(SeoConfigEntity)
    private readonly seoConfigsRepository: Repository<SeoConfigEntity>,
  ) {}

  async create(data: SeoConfig): Promise<SeoConfig> {
    const persistenceModel = SeoConfigMapper.toPersistence(data);
    const newEntity = await this.seoConfigsRepository.save(
      this.seoConfigsRepository.create(persistenceModel),
    );
    return SeoConfigMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterSeoConfigDto | null;
    sortOptions?: SortSeoConfigDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<SeoConfig[]> {
    const where: FindOptionsWhere<SeoConfigEntity> = {};

    if (filterOptions?.isActive !== undefined) {
      where.isActive = filterOptions.isActive;
    }
    if (filterOptions?.destinationId !== undefined) {
      where.destinationId = filterOptions.destinationId;
    }
    if (filterOptions?.regionId !== undefined) {
      where.regionId = filterOptions.regionId;
    }
    if (filterOptions?.planId !== undefined) {
      where.planId = filterOptions.planId;
    }

    const entities = await this.seoConfigsRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.length
        ? (sortOptions.reduce(
            (accumulator, sort) => ({
              ...accumulator,
              [sort.orderBy as string]: sort.order,
            }),
            {} as Record<string, string>,
          ) as any)
        : { createdAt: 'DESC' },
    });

    return entities.map((entity) => SeoConfigMapper.toDomain(entity));
  }

  async findById(id: SeoConfig['id']): Promise<NullableType<SeoConfig>> {
    const entity = await this.seoConfigsRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? SeoConfigMapper.toDomain(entity) : null;
  }

  async findByUrl(url: SeoConfig['url']): Promise<NullableType<SeoConfig>> {
    const entity = await this.seoConfigsRepository.findOne({ where: { url } });
    return entity ? SeoConfigMapper.toDomain(entity) : null;
  }

  async update(
    id: SeoConfig['id'],
    payload: Partial<SeoConfig>,
  ): Promise<SeoConfig> {
    const entity = await this.seoConfigsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('SeoConfig not found');
    }

    const updatedEntity = await this.seoConfigsRepository.save(
      this.seoConfigsRepository.create(
        SeoConfigMapper.toPersistence({
          ...SeoConfigMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return SeoConfigMapper.toDomain(updatedEntity);
  }

  async remove(id: SeoConfig['id']): Promise<void> {
    await this.seoConfigsRepository.softDelete(id);
  }
}
