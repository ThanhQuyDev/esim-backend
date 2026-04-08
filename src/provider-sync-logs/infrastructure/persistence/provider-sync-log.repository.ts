import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ProviderSyncLog } from '../../domain/provider-sync-log';
import { FilterProviderSyncLogDto, SortProviderSyncLogDto } from '../../dto/query-provider-sync-log.dto';

export abstract class ProviderSyncLogRepository {
  abstract create(
    data: Omit<ProviderSyncLog, 'id' | 'createdAt'>,
  ): Promise<ProviderSyncLog>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProviderSyncLogDto | null;
    sortOptions?: SortProviderSyncLogDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<ProviderSyncLog[]>;

  abstract findById(id: ProviderSyncLog['id']): Promise<NullableType<ProviderSyncLog>>;

  abstract update(
    id: ProviderSyncLog['id'],
    payload: DeepPartial<ProviderSyncLog>,
  ): Promise<ProviderSyncLog | null>;
}
