import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Esim, EsimTopupDto } from '../../domain/esim';

/**
 * Every topup applied to one eSIM, rolled up (#025, #027).
 *
 * The sums are per ICCID because an eSIM can be topped up several times and the
 * export reconciles on the total, not on the last one.
 */
export interface EsimTopupSummary {
  count: number;
  lastAt: Date | null;
  /** Total charged for the topups, in VND. */
  vndPrice: number;
  /** Total they cost us, in VND. */
  vndCostPrice: number;
  /** Package names, newest first, comma-separated. */
  packageNames: string | null;
}
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
  }): Promise<[Esim[], number]>;

  abstract findById(id: Esim['id']): Promise<NullableType<Esim>>;

  abstract findByIdWithRelations(id: Esim['id']): Promise<NullableType<Esim>>;

  abstract findByIccid(iccid: Esim['iccid']): Promise<NullableType<Esim>>;

  abstract findByIccidWithDeleted(
    iccid: Esim['iccid'],
  ): Promise<NullableType<Esim>>;

  abstract findByOrderItemIds(orderItemIds: number[]): Promise<Esim[]>;

  /**
   * Local-inventory eSIMs that can be handed to a customer right now: unsold,
   * unassigned and NOT past their expiry (#021). FEFO order, so the stock closest
   * to expiring is sold first.
   */
  abstract findAvailableByPlanId(
    planId: number,
    limit: number,
  ): Promise<Esim[]>;

  /** Unsold eSIMs whose expiry has already passed — dead stock (#021). */
  abstract countExpiredAvailableByPlanIds(
    planIds: number[],
  ): Promise<Record<number, number>>;

  /**
   * Paid topups per ICCID, with the latest date (#025). Derived from the orders,
   * so it also covers eSIMs topped up before the column existed.
   */
  abstract countTopupsByIccids(
    iccids: string[],
  ): Promise<Map<string, EsimTopupSummary>>;

  /**
   * Every topup applied to one eSIM, newest first (#026), from the snapshot the
   * order stored at checkout.
   */
  abstract findTopupsByIccid(iccid: string): Promise<EsimTopupDto[]>;

  abstract update(
    id: Esim['id'],
    payload: DeepPartial<Esim>,
  ): Promise<Esim | null>;

  abstract remove(id: Esim['id']): Promise<void>;

  abstract removeMany(ids: Esim['id'][]): Promise<number>;

  abstract restore(id: Esim['id']): Promise<void>;

  abstract markRefundedByOrderId(orderId: number): Promise<number>;

  /**
   * eSIMs worth asking the provider about: sold/active, not expired, and
   * belonging to a provider that actually exposes a usage API.
   */
  abstract findDueForUsageRefresh(
    providers: string[],
    limit: number,
  ): Promise<Esim[]>;

  abstract softDeleteByStatusOlderThan(
    status: string,
    olderThanDays: number,
  ): Promise<number>;

  abstract findAllForExport(
    filterOptions?: FilterEsimDto | null,
  ): Promise<Esim[]>;
}
