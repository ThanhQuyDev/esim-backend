import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Plan } from '../../domain/plan';
import { FilterPlanDto, SortPlanDto } from '../../dto/query-plan.dto';

export abstract class PlanRepository {
  abstract create(
    data: Omit<Plan, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
  ): Promise<Plan>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterPlanDto | null;
    sortOptions?: SortPlanDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Plan[]>;

  abstract findById(id: Plan['id']): Promise<NullableType<Plan>>;

  abstract findBySlug(slug: Plan['slug']): Promise<NullableType<Plan>>;

  abstract update(
    id: Plan['id'],
    payload: DeepPartial<Plan>,
  ): Promise<Plan | null>;

  abstract markCheapestPlans(): Promise<void>;

  abstract batchUpdateDiscount(ids: number[], discount: number): Promise<void>;

  abstract recalculatePrices(profitPercentage: number): Promise<void>;

  abstract updateAllVndPrices(rate: number): Promise<void>;

  abstract remove(id: Plan['id']): Promise<void>;

  abstract deactivateStaleProviderPlans(
    provider: string,
    syncStartedAt: Date,
  ): Promise<void>;

  abstract deactivateAllProviderPlans(provider: string): Promise<void>;
}
