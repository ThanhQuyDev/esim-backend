import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
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
  }): Promise<[SeoConfig[], number]> {
    // Common filter clauses applied to every OR branch when search is used.
    const baseWhere: FindOptionsWhere<SeoConfigEntity> = {};

    if (filterOptions?.isActive !== undefined) {
      baseWhere.isActive = filterOptions.isActive;
    }
    if (filterOptions?.destinationId !== undefined) {
      baseWhere.destinationId = filterOptions.destinationId;
    }
    if (filterOptions?.regionId !== undefined) {
      baseWhere.regionId = filterOptions.regionId;
    }
    if (filterOptions?.planId !== undefined) {
      baseWhere.planId = filterOptions.planId;
    }

    // When `search` is provided, match across url / metaTitle / metaDescription
    // using an array of where clauses (TypeORM treats this as OR).
    let where:
      | FindOptionsWhere<SeoConfigEntity>
      | FindOptionsWhere<SeoConfigEntity>[] = baseWhere;

    if (filterOptions?.search) {
      const term = `%${filterOptions.search}%`;
      where = [
        { ...baseWhere, url: ILike(term) },
        { ...baseWhere, metaTitle: ILike(term) },
        { ...baseWhere, metaDescription: ILike(term) },
      ];
    }

    const [entities, count] = await this.seoConfigsRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.length
        ? sortOptions.reduce(
            (accumulator, sort) => ({
              ...accumulator,
              ...(sort.orderBy ? { [sort.orderBy]: sort.order ?? 'ASC' } : {}),
            }),
            {} as Record<string, string>,
          )
        : { createdAt: 'DESC' },
    });

    return [entities.map((entity) => SeoConfigMapper.toDomain(entity)), count];
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
