import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { DestinationEntity } from '../entities/destination.entity';
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
    const where: FindOptionsWhere<DestinationEntity>[] = [];
    const baseWhere: FindOptionsWhere<DestinationEntity> = {};

    if (filterOptions?.isPopular !== undefined) {
      baseWhere.isPopular = filterOptions.isPopular;
    }
    if (filterOptions?.isActive !== undefined) {
      baseWhere.isActive = filterOptions.isActive;
    }

    if (filterOptions?.search) {
      where.push(
        { ...baseWhere, name: ILike(`%${filterOptions.search}%`) },
        { ...baseWhere, keySearch: ILike(`%${filterOptions.search}%`) },
      );
    } else {
      where.push(baseWhere);
    }

    const entities = await this.destinationsRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
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

    return entities.map((entity) => DestinationMapper.toDomain(entity));
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
