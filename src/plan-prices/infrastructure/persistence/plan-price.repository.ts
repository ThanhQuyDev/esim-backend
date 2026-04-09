import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { PlanPrice } from '../../domain/plan-price';
import {
  FilterPlanPriceDto,
  SortPlanPriceDto,
} from '../../dto/query-plan-price.dto';

export abstract class PlanPriceRepository {
  abstract create(
    data: Omit<PlanPrice, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
  ): Promise<PlanPrice>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterPlanPriceDto | null;
    sortOptions?: SortPlanPriceDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<PlanPrice[]>;

  abstract findById(id: PlanPrice['id']): Promise<NullableType<PlanPrice>>;

  abstract findByPlanIdAndCurrency(
    planId: PlanPrice['planId'],
    currency: PlanPrice['currency'],
  ): Promise<NullableType<PlanPrice>>;

  abstract update(
    id: PlanPrice['id'],
    payload: DeepPartial<PlanPrice>,
  ): Promise<PlanPrice | null>;

  abstract remove(id: PlanPrice['id']): Promise<void>;
}
