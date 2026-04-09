import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ProviderSyncLogEntity } from '../entities/provider-sync-log.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterProviderSyncLogDto,
  SortProviderSyncLogDto,
} from '../../../../dto/query-provider-sync-log.dto';
import { ProviderSyncLog } from '../../../../domain/provider-sync-log';
import { ProviderSyncLogRepository } from '../../provider-sync-log.repository';
import { ProviderSyncLogMapper } from '../mappers/provider-sync-log.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ProviderSyncLogsRelationalRepository implements ProviderSyncLogRepository {
  constructor(
    @InjectRepository(ProviderSyncLogEntity)
    private readonly providerSyncLogsRepository: Repository<ProviderSyncLogEntity>,
  ) {}

  async create(data: ProviderSyncLog): Promise<ProviderSyncLog> {
    const persistenceModel = ProviderSyncLogMapper.toPersistence(data);
    const newEntity = await this.providerSyncLogsRepository.save(
      this.providerSyncLogsRepository.create(persistenceModel),
    );
    return ProviderSyncLogMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProviderSyncLogDto | null;
    sortOptions?: SortProviderSyncLogDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<ProviderSyncLog[]> {
    const where: FindOptionsWhere<ProviderSyncLogEntity> = {};

    if (filterOptions?.provider) {
      where.provider = filterOptions.provider;
    }
    if (filterOptions?.syncType) {
      where.syncType = filterOptions.syncType;
    }
    if (filterOptions?.status) {
      where.status = filterOptions.status;
    }

    const entities = await this.providerSyncLogsRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.reduce(
        (accumulator, sort) => ({
          ...accumulator,
          [sort.orderBy]: sort.order,
        }),
        {},
      ),
    });

    return entities.map((entity) => ProviderSyncLogMapper.toDomain(entity));
  }

  async findById(
    id: ProviderSyncLog['id'],
  ): Promise<NullableType<ProviderSyncLog>> {
    const entity = await this.providerSyncLogsRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? ProviderSyncLogMapper.toDomain(entity) : null;
  }

  async update(
    id: ProviderSyncLog['id'],
    payload: Partial<ProviderSyncLog>,
  ): Promise<ProviderSyncLog> {
    const entity = await this.providerSyncLogsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('ProviderSyncLog not found');
    }

    const updatedEntity = await this.providerSyncLogsRepository.save(
      this.providerSyncLogsRepository.create(
        ProviderSyncLogMapper.toPersistence({
          ...ProviderSyncLogMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ProviderSyncLogMapper.toDomain(updatedEntity);
  }
}
