import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository, IsNull } from 'typeorm';
import { RegionEntity } from '../entities/region.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterRegionDto, SortRegionDto } from '../../../../dto/query-region.dto';
import { Region } from '../../../../domain/region';
import { RegionRepository } from '../../region.repository';
import { RegionMapper } from '../mappers/region.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class RegionsRelationalRepository implements RegionRepository {
  constructor(
    @InjectRepository(RegionEntity)
    private readonly regionsRepository: Repository<RegionEntity>,
  ) {}

  async create(data: Region): Promise<Region> {
    const persistenceModel = RegionMapper.toPersistence(data);
    const newEntity = await this.regionsRepository.save(
      this.regionsRepository.create(persistenceModel),
    );
    return RegionMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterRegionDto | null;
    sortOptions?: SortRegionDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Region[]> {
    const where: FindOptionsWhere<RegionEntity> = {};

    if (filterOptions?.isActive !== undefined) {
      where.isActive = filterOptions.isActive;
    }
    if (filterOptions?.parentId !== undefined) {
      where.parentId = filterOptions.parentId === null ? IsNull() as any : filterOptions.parentId;
    }

    const entities = await this.regionsRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where: where,
      relations: ['children'],
      order: sortOptions?.reduce(
        (accumulator, sort) => ({
          ...accumulator,
          [sort.orderBy]: sort.order,
        }),
        {},
      ),
    });

    return entities.map((entity) => RegionMapper.toDomain(entity));
  }

  async findById(id: Region['id']): Promise<NullableType<Region>> {
    const entity = await this.regionsRepository.findOne({
      where: { id: Number(id) },
      relations: ['children'],
    });
    return entity ? RegionMapper.toDomain(entity) : null;
  }

  async findBySlug(slug: Region['slug']): Promise<NullableType<Region>> {
    const entity = await this.regionsRepository.findOne({
      where: { slug },
      relations: ['children'],
    });
    return entity ? RegionMapper.toDomain(entity) : null;
  }

  async update(id: Region['id'], payload: Partial<Region>): Promise<Region> {
    const entity = await this.regionsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Region not found');
    }

    const updatedEntity = await this.regionsRepository.save(
      this.regionsRepository.create(
        RegionMapper.toPersistence({
          ...RegionMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return RegionMapper.toDomain(updatedEntity);
  }

  async remove(id: Region['id']): Promise<void> {
    await this.regionsRepository.softDelete(id);
  }
}
