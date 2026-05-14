import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ProfitMargin } from '../../domain/profit-margin';
import {
  FilterProfitMarginDto,
  SortProfitMarginDto,
} from '../../dto/query-profit-margin.dto';
import { DeepPartial } from '../../../utils/types/deep-partial.type';

export abstract class ProfitMarginRepository {
  abstract create(
    data: Omit<ProfitMargin, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<ProfitMargin>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProfitMarginDto | null;
    sortOptions?: SortProfitMarginDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[ProfitMargin[], number]>;

  abstract findById(
    id: ProfitMargin['id'],
  ): Promise<NullableType<ProfitMargin>>;

  abstract update(
    id: ProfitMargin['id'],
    payload: DeepPartial<ProfitMargin>,
  ): Promise<ProfitMargin | null>;

  abstract remove(id: ProfitMargin['id']): Promise<void>;
}
