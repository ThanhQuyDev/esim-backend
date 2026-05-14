import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { EsimEntity } from '../entities/esim.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterEsimDto, SortEsimDto } from '../../../../dto/query-esim.dto';
import { Esim } from '../../../../domain/esim';
import { EsimRepository } from '../../esim.repository';
import { EsimMapper } from '../mappers/esim.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class EsimsRelationalRepository implements EsimRepository {
  constructor(
    @InjectRepository(EsimEntity)
    private readonly esimsRepository: Repository<EsimEntity>,
  ) {}

  async create(data: Esim): Promise<Esim> {
    const persistenceModel = EsimMapper.toPersistence(data);
    const newEntity = await this.esimsRepository.save(
      this.esimsRepository.create(persistenceModel),
    );
    return EsimMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterEsimDto | null;
    sortOptions?: SortEsimDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Esim[], number]> {
    const where: FindOptionsWhere<EsimEntity> = {};

    if (filterOptions?.status) {
      where.status = filterOptions.status;
    }
    if (filterOptions?.userId !== undefined) {
      where.userId = filterOptions.userId;
    }

    const [entities, count] = await this.esimsRepository.findAndCount({
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

    return [entities.map((entity) => EsimMapper.toDomain(entity)), count];
  }

  async findById(id: Esim['id']): Promise<NullableType<Esim>> {
    const entity = await this.esimsRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? EsimMapper.toDomain(entity) : null;
  }

  async findByIdWithRelations(id: Esim['id']): Promise<NullableType<Esim>> {
    const entity = await this.esimsRepository.findOne({
      where: { id: Number(id) },
      relations: ['user', 'plan'],
    });
    return entity ? EsimMapper.toDomain(entity) : null;
  }

  async findByIccid(iccid: Esim['iccid']): Promise<NullableType<Esim>> {
    const entity = await this.esimsRepository.findOne({
      where: { iccid },
    });
    return entity ? EsimMapper.toDomain(entity) : null;
  }

  async findByOrderItemIds(orderItemIds: number[]): Promise<Esim[]> {
    if (!orderItemIds.length) return [];
    const entities = await this.esimsRepository.find({
      where: orderItemIds.map((id) => ({ orderItemId: id })),
    });
    return entities.map(EsimMapper.toDomain);
  }

  async findAvailableByPlanId(planId: number, limit: number): Promise<Esim[]> {
    const entities = await this.esimsRepository.find({
      where: {
        planId,
        status: 'available',
        orderItemId: null as any,
        userId: null as any,
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
    return entities.map(EsimMapper.toDomain);
  }

  async update(id: Esim['id'], payload: Partial<Esim>): Promise<Esim> {
    const entity = await this.esimsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Esim not found');
    }

    const updatedEntity = await this.esimsRepository.save(
      this.esimsRepository.create(
        EsimMapper.toPersistence({
          ...EsimMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return EsimMapper.toDomain(updatedEntity);
  }

  async remove(id: Esim['id']): Promise<void> {
    await this.esimsRepository.softDelete(id);
  }
}
