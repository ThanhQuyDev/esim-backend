import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RegionEntity } from '../entities/region.entity';
import { DestinationEntity } from '../../../../../destinations/infrastructure/persistence/relational/entities/destination.entity';
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
    @InjectRepository(DestinationEntity)
    private readonly destinationsRepository: Repository<DestinationEntity>,
  ) {}

  async create(data: Region, destinationIds?: number[]): Promise<Region> {
    const persistenceModel = RegionMapper.toPersistence(data);
    const newEntity = await this.regionsRepository.save(
      this.regionsRepository.create(persistenceModel),
    );

    if (destinationIds?.length) {
      const destinations = await this.destinationsRepository.findBy({
        id: In(destinationIds),
      });
      if (destinations.length) {
        const values = destinations
          .map((d) => `(${d.id}, ${newEntity.id})`)
          .join(', ');
        await this.regionsRepository.query(
          `INSERT INTO "destination_region" ("destinationId", "regionId") VALUES ${values} ON CONFLICT DO NOTHING`,
        );
        newEntity.destinations = destinations;
      }
    }

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
  }): Promise<[Region[], number]> {
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
    } else {
      qb.orderBy('region.createdAt', 'DESC');
    }

    const countQb = qb.clone();
    const count = await countQb.getCount();

    qb.offset((paginationOptions.page - 1) * paginationOptions.limit);
    qb.limit(paginationOptions.limit);

    const rawResults = await qb.getRawAndEntities();

    const data = rawResults.entities.map((entity, index) => {
      const domain = RegionMapper.toDomain(entity);
      domain.destinationCount = parseInt(
        rawResults.raw[index]?.dest_count ?? '0',
        10,
      );
      return domain;
    });

    return [data, count];
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

  async update(
    id: Region['id'],
    payload: Partial<Region>,
    destinationIds?: number[],
  ): Promise<Region> {
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

    if (destinationIds !== undefined) {
      // Remove existing destination associations
      await this.regionsRepository.query(
        `DELETE FROM "destination_region" WHERE "regionId" = $1`,
        [Number(id)],
      );

      // Add new destination associations
      if (destinationIds.length) {
        const destinations = await this.destinationsRepository.findBy({
          id: In(destinationIds),
        });
        if (destinations.length) {
          const values = destinations
            .map((d) => `(${d.id}, ${Number(id)})`)
            .join(', ');
          await this.regionsRepository.query(
            `INSERT INTO "destination_region" ("destinationId", "regionId") VALUES ${values} ON CONFLICT DO NOTHING`,
          );
          updatedEntity.destinations = destinations;
        }
      } else {
        updatedEntity.destinations = [];
      }
    }

    return RegionMapper.toDomain(updatedEntity);
  }

  async remove(id: Region['id']): Promise<void> {
    await this.regionsRepository.softDelete(id);
  }
}
