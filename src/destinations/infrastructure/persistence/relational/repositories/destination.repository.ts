import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DestinationEntity } from '../entities/destination.entity';
import { PlanEntity } from '../../../../../plans/infrastructure/persistence/relational/entities/plan.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterDestinationDto,
  SortDestinationDto,
} from '../../../../dto/query-destination.dto';
import { Destination } from '../../../../domain/destination';
import { DestinationRepository } from '../../destination.repository';
import { DestinationMapper } from '../mappers/destination.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class DestinationsRelationalRepository implements DestinationRepository {
  constructor(
    @InjectRepository(DestinationEntity)
    private readonly destinationsRepository: Repository<DestinationEntity>,
  ) {}

  async create(data: Destination): Promise<Destination> {
    const persistenceModel = DestinationMapper.toPersistence(data);
    const newEntity = await this.destinationsRepository.save(
      this.destinationsRepository.create(persistenceModel),
    );
    return DestinationMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterDestinationDto | null;
    sortOptions?: SortDestinationDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Destination[]> {
    const qb = this.destinationsRepository
      .createQueryBuilder('destination')
      .addSelect((subQuery) => {
        return subQuery
          .select('MIN(plan."vndPrice")', 'fromPrice')
          .from(PlanEntity, 'plan')
          .where('plan."destinationId" = destination.id')
          .andWhere('plan."isActive" = true')
          .andWhere('plan."deletedAt" IS NULL');
      }, 'fromPrice');

    if (filterOptions?.isPopular !== undefined) {
      qb.andWhere('destination.isPopular = :isPopular', {
        isPopular: filterOptions.isPopular,
      });
    }
    if (filterOptions?.isActive !== undefined) {
      qb.andWhere('destination.isActive = :isActive', {
        isActive: filterOptions.isActive,
      });
    }
    if (filterOptions?.search) {
      qb.andWhere(
        '(destination.name ILIKE :search OR destination.keySearch ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );
    }

    qb.andWhere('destination.deletedAt IS NULL');

    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(
          `destination.${sort.orderBy}`,
          sort.order as 'ASC' | 'DESC',
        );
      });
    } else {
      qb.addOrderBy('destination.createdAt', 'DESC');
    }

    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const raw = await qb.getRawAndEntities();

    return raw.entities.map((entity, index) => {
      const domain = DestinationMapper.toDomain(entity);
      domain.fromPrice = raw.raw[index]?.fromPrice
        ? Number(raw.raw[index].fromPrice)
        : null;
      return domain;
    });
  }

  async findById(id: Destination['id']): Promise<NullableType<Destination>> {
    const entity = await this.destinationsRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? DestinationMapper.toDomain(entity) : null;
  }

  async findBySlug(
    slug: Destination['slug'],
  ): Promise<NullableType<Destination>> {
    const entity = await this.destinationsRepository.findOne({
      where: { slug },
      relations: ['regions'],
    });

    return entity ? DestinationMapper.toDomain(entity) : null;
  }

  async findByCountryCode(
    countryCode: Destination['countryCode'],
  ): Promise<NullableType<Destination>> {
    const entity = await this.destinationsRepository.findOne({
      where: { countryCode },
    });

    return entity ? DestinationMapper.toDomain(entity) : null;
  }

  async findByName(
    name: Destination['name'],
  ): Promise<NullableType<Destination>> {
    const entity = await this.destinationsRepository.findOne({
      where: { name },
    });

    return entity ? DestinationMapper.toDomain(entity) : null;
  }

  async update(
    id: Destination['id'],
    payload: Partial<Destination>,
  ): Promise<Destination> {
    const entity = await this.destinationsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Destination not found');
    }

    const updatedEntity = await this.destinationsRepository.save(
      this.destinationsRepository.create(
        DestinationMapper.toPersistence({
          ...DestinationMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return DestinationMapper.toDomain(updatedEntity);
  }

  async addRegion(
    destinationId: Destination['id'],
    regionId: number,
  ): Promise<void> {
    const entity = await this.destinationsRepository.findOne({
      where: { id: Number(destinationId) },
      relations: ['regions'],
    });
    if (!entity) return;

    const alreadyLinked = entity.regions?.some((r) => r.id === regionId);
    if (alreadyLinked) return;

    await this.destinationsRepository
      .createQueryBuilder()
      .relation(DestinationEntity, 'regions')
      .of(destinationId)
      .add(regionId);
  }

  async remove(id: Destination['id']): Promise<void> {
    await this.destinationsRepository.softDelete(id);
  }
}
