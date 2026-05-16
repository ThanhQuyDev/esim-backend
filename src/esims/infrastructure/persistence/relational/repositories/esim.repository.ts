import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    const qb = this.esimsRepository.createQueryBuilder('esim');

    if (filterOptions?.status) {
      qb.andWhere('esim.status = :status', { status: filterOptions.status });
    }
    if (filterOptions?.userId !== undefined) {
      qb.andWhere('esim.userId = :userId', { userId: filterOptions.userId });
    }
    if (filterOptions?.search) {
      qb.andWhere(
        '(esim.iccid ILIKE :search OR esim.esimTranNo ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );
    }

    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(`esim.${sort.orderBy}`, sort.order as 'ASC' | 'DESC');
      });
    } else {
      qb.orderBy('esim.createdAt', 'DESC');
    }

    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();

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

  async softDeleteByStatusOlderThan(
    status: string,
    olderThan: Date,
  ): Promise<number> {
    const result = await this.esimsRepository
      .createQueryBuilder()
      .softDelete()
      .where('status = :status', { status })
      .andWhere('updatedAt < :olderThan', { olderThan })
      .andWhere('deletedAt IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  async findAllForExport(
    filterOptions?: FilterEsimDto | null,
  ): Promise<Esim[]> {
    const qb = this.esimsRepository.createQueryBuilder('esim');

    if (filterOptions?.status) {
      qb.andWhere('esim.status = :status', { status: filterOptions.status });
    }
    if (filterOptions?.userId !== undefined) {
      qb.andWhere('esim.userId = :userId', { userId: filterOptions.userId });
    }
    if (filterOptions?.search) {
      qb.andWhere(
        '(esim.iccid ILIKE :search OR esim.esimTranNo ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );
    }

    qb.orderBy('esim.createdAt', 'DESC');

    const entities = await qb.getMany();
    return entities.map((entity) => EsimMapper.toDomain(entity));
  }
}
