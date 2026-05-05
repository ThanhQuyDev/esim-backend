import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ProfitMarginTier } from '../../domain/profit-margin-tier';
import {
  FilterProfitMarginTierDto,
  SortProfitMarginTierDto,
} from '../../dto/query-profit-margin-tier.dto';
import { DeepPartial } from '../../../utils/types/deep-partial.type';

export abstract class ProfitMarginTierRepository {
  abstract create(
    data: Omit<
      ProfitMarginTier,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
    >,
  ): Promise<ProfitMarginTier>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProfitMarginTierDto | null;
    sortOptions?: SortProfitMarginTierDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<ProfitMarginTier[]>;

  abstract findAll(): Promise<ProfitMarginTier[]>;

  abstract findById(
    id: ProfitMarginTier['id'],
  ): Promise<NullableType<ProfitMarginTier>>;

  abstract update(
    id: ProfitMarginTier['id'],
    payload: DeepPartial<ProfitMarginTier>,
  ): Promise<ProfitMarginTier | null>;

  abstract remove(id: ProfitMarginTier['id']): Promise<void>;

  abstract findOverlapping(
    minVnd: number,
    maxVnd: number,
    excludeId?: number,
  ): Promise<ProfitMarginTier[]>;
}
