import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ApnSupport } from '../../domain/apn-support';

export type ApnSupportRow = Omit<ApnSupport, 'id' | 'createdAt' | 'updatedAt'>;

/** List filters for the CMS table (#044, test round 4). */
export type ApnSupportFilters = {
  /** Exact APNs picked in the select box. */
  apns?: string[];
  /**
   * Platforms that must be supported, e.g. "tiktokIos", "chatGpt". A bare app
   * name means it works on both devices.
   */
  supports?: string[];
  /** Only rows still waiting for their app columns. */
  needsReview?: boolean;
};

export abstract class ApnSupportRepository {
  abstract findAllWithPagination({
    paginationOptions,
    filters,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: ApnSupportFilters;
  }): Promise<[ApnSupport[], number]>;

  /** Every APN in the table, for the filter's select box. */
  abstract listApns(): Promise<{ apn: string; apnLabel: string }[]>;

  abstract findById(id: string): Promise<NullableType<ApnSupport>>;

  abstract create(row: ApnSupportRow): Promise<ApnSupport>;

  abstract update(
    id: string,
    patch: Partial<ApnSupportRow>,
  ): Promise<NullableType<ApnSupport>>;

  abstract remove(id: string): Promise<void>;

  /**
   * The distinct APNs supplier plans use (live plans only), as written —
   * several can share one plan, comma-separated.
   */
  abstract distinctPlanApns(): Promise<string[]>;

  /** Insert the given rows, skipping any APN already in the table. */
  abstract insertMissing(rows: ApnSupportRow[]): Promise<number>;

  /** Every row, for building the APN → capabilities lookup. */
  abstract findAll(): Promise<ApnSupport[]>;

  abstract findByApn(apn: string): Promise<NullableType<ApnSupport>>;

  /**
   * Swap the whole table for `rows`, in one transaction (#065).
   *
   * An upload is the authoritative list as of that moment, so this is a replace
   * rather than a merge. In one transaction because a half-applied APN table is
   * worse than the old one: it would quietly mark plans as TikTok-incapable.
   */
  abstract replaceAll(rows: ApnSupportRow[]): Promise<number>;

  abstract count(): Promise<number>;
}
