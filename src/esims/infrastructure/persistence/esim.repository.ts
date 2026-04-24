import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Esim } from '../../domain/esim';
import { FilterEsimDto, SortEsimDto } from '../../dto/query-esim.dto';

export abstract class EsimRepository {
  abstract create(
    data: Omit<Esim, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
  ): Promise<Esim>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterEsimDto | null;
    sortOptions?: SortEsimDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Esim[]>;

  abstract findById(id: Esim['id']): Promise<NullableType<Esim>>;

  abstract findByIccid(iccid: Esim['iccid']): Promise<NullableType<Esim>>;

  abstract findByOrderItemIds(orderItemIds: number[]): Promise<Esim[]>;

  abstract update(
    id: Esim['id'],
    payload: DeepPartial<Esim>,
  ): Promise<Esim | null>;

  abstract remove(id: Esim['id']): Promise<void>;
}
