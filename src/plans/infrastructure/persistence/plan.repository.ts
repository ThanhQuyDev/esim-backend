import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Plan } from '../../domain/plan';
import { FilterPlanDto, SortPlanDto } from '../../dto/query-plan.dto';

/**
 * What one local-inventory plan has left in the warehouse: how many eSIMs, and
 * the soonest any of them expires (#040, #070).
 */
export type LocalStockSummary = {
  count: number;
  earliestExpiresAt: Date | null;
};

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
  }): Promise<[Plan[], number]>;

  abstract findById(id: Plan['id']): Promise<NullableType<Plan>>;

  /**
   * Unsold eSIMs per plan, for local inventory, plus the earliest expiry among
   * them — the activation deadline that holds for whichever one the customer is
   * handed (#070). Keyed by plan id; a plan with no stock left is simply absent
   * from the map.
   */
  abstract countAvailableEsimsByPlanIds(
    planIds: number[],
  ): Promise<Record<number, LocalStockSummary>>;

  abstract findBySlug(slug: Plan['slug']): Promise<NullableType<Plan>>;

  abstract update(
    id: Plan['id'],
    payload: DeepPartial<Plan>,
  ): Promise<Plan | null>;

  abstract markCheapestPlans(): Promise<void>;

  /**
   * Take every active plan of one supplier off sale, flagging the rows as
   * `disabledByProvider` so they can be restored later (#005). Returns the
   * number of rows deactivated.
   */
  abstract deactivatePlansForProvider(provider: string): Promise<number>;

  /** Reactivate only the rows flagged `disabledByProvider` (#005). */
  abstract reactivatePlansDisabledByProvider(provider: string): Promise<number>;

  /** Recount units sold per plan, destination and region (#053). */
  abstract recalculateSoldCounts(): Promise<void>;

  abstract batchUpdateDiscount(ids: number[], discount: number): Promise<void>;

  abstract recalculatePricesByTiers(
    tiers: Array<{
      minVnd: number;
      maxVnd: number;
      percentage: number;
      fixedAmountVnd?: number;
    }>,
    exchangeRate?: number,
  ): Promise<void>;

  abstract updateAllVndPrices(rate: number): Promise<void>;

  abstract remove(id: Plan['id']): Promise<void>;

  /** Distinct non-empty APN values, to populate the CMS filter (#010). */
  abstract getDistinctApns(): Promise<string[]>;

  abstract getDistinctProvidersByDestinationId(
    destinationId: number,
  ): Promise<string[]>;

  abstract getDistinctProvidersByRegionId(regionId: number): Promise<string[]>;

  abstract getLocalCarriers(): Promise<
    { provider: string; fromVndPrice: number; planCount: number }[]
  >;

  abstract deactivateStaleProviderPlans(
    provider: string,
    syncStartedAt: Date,
  ): Promise<void>;

  abstract softDeleteSupersededProviderPlans(
    provider: string,
    syncStartedAt: Date,
  ): Promise<number>;

  abstract deactivateAllProviderPlans(provider: string): Promise<void>;

  abstract findAllForExport(
    filterOptions?: FilterPlanDto | null,
  ): Promise<Plan[]>;
}
