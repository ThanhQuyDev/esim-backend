import { Injectable } from '@nestjs/common';
import { CreateProviderSyncLogDto } from './dto/create-provider-sync-log.dto';
import { UpdateProviderSyncLogDto } from './dto/update-provider-sync-log.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterProviderSyncLogDto, SortProviderSyncLogDto } from './dto/query-provider-sync-log.dto';
import { ProviderSyncLogRepository } from './infrastructure/persistence/provider-sync-log.repository';
import { ProviderSyncLog } from './domain/provider-sync-log';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class ProviderSyncLogsService {
  constructor(
    private readonly providerSyncLogsRepository: ProviderSyncLogRepository,
  ) {}

  async create(
    createDto: CreateProviderSyncLogDto,
  ): Promise<ProviderSyncLog> {
    return this.providerSyncLogsRepository.create({
      provider: createDto.provider,
      syncType: createDto.syncType,
      status: createDto.status ?? 'started',
      itemsSynced: createDto.itemsSynced ?? null,
      errorMessage: createDto.errorMessage ?? null,
      startedAt: createDto.startedAt,
      completedAt: createDto.completedAt ?? null,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProviderSyncLogDto | null;
    sortOptions?: SortProviderSyncLogDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<ProviderSyncLog[]> {
    return this.providerSyncLogsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: ProviderSyncLog['id']): Promise<NullableType<ProviderSyncLog>> {
    return this.providerSyncLogsRepository.findById(id);
  }

  async update(
    id: ProviderSyncLog['id'],
    updateDto: UpdateProviderSyncLogDto,
  ): Promise<ProviderSyncLog | null> {
    return this.providerSyncLogsRepository.update(id, {
      status: updateDto.status,
      itemsSynced: updateDto.itemsSynced,
      errorMessage: updateDto.errorMessage,
      completedAt: updateDto.completedAt,
    });
  }
}
