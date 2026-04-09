import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegionEntity } from '../entities/region.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterRegionDto,
  SortRegionDto,
} from '../../../../dto/query-region.dto';
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
    const qb = this.regionsRepository
      .createQueryBuilder('region')
      .leftJoin('destination_region', 'dr', 'dr."regionId" = region.id')
      .leftJoin('destination', 'dest', 'dest.id = dr."destinationId"')
      .addSelect('COUNT(DISTINCT dest.id)', 'dest_count');

    if (filterOptions?.isActive !== undefined) {
      qb.andWhere('region."isActive" = :isActive', {
        isActive: filterOptions.isActive,
      });
    }

    if (filterOptions?.search) {
      qb.andWhere('(region.name ILIKE :search OR dest.name ILIKE :search)', {
        search: `%${filterOptions.search}%`,
      });
    }

    qb.groupBy('region.id');

    if (sortOptions?.length) {
      for (const sort of sortOptions) {
        qb.addOrderBy(
          `region.${String(sort.orderBy)}`,
          sort.order as 'ASC' | 'DESC',
        );
      }
    }

    qb.offset((paginationOptions.page - 1) * paginationOptions.limit);
    qb.limit(paginationOptions.limit);

    const rawResults = await qb.getRawAndEntities();

    return rawResults.entities.map((entity, index) => {
      const domain = RegionMapper.toDomain(entity);
      domain.destinationCount = parseInt(
        rawResults.raw[index]?.dest_count ?? '0',
        10,
      );
      return domain;
    });
  }

  async findById(id: Region['id']): Promise<NullableType<Region>> {
    const entity = await this.regionsRepository.findOne({
      where: { id: Number(id) },
    });
    if (!entity) return null;

    const destinations = await this.regionsRepository.query(
      `SELECT d.* FROM "destination" d
       INNER JOIN "destination_region" dr ON dr."destinationId" = d.id
       WHERE dr."regionId" = $1 AND d."deletedAt" IS NULL`,
      [id],
    );
    entity.destinations = destinations;

    return RegionMapper.toDomain(entity);
  }

  async findBySlug(slug: Region['slug']): Promise<NullableType<Region>> {
    const entity = await this.regionsRepository.findOne({
      where: { slug },
    });
    if (!entity) return null;

    const destinations = await this.regionsRepository.query(
      `SELECT d.* FROM "destination" d
       INNER JOIN "destination_region" dr ON dr."destinationId" = d.id
       WHERE dr."regionId" = $1 AND d."deletedAt" IS NULL`,
      [entity.id],
    );
    entity.destinations = destinations;

    return RegionMapper.toDomain(entity);
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
