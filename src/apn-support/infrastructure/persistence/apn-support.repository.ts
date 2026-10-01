import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { ApnSupport } from '../../domain/apn-support';

export type ApnSupportRow = Omit<ApnSupport, 'id' | 'createdAt' | 'updatedAt'>;

export abstract class ApnSupportRepository {
  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<[ApnSupport[], number]>;

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
