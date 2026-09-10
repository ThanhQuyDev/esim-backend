import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { CustomPaymentLink } from '../../domain/custom-payment-link';

export interface CustomPaymentLinkFilter {
  status?: string | null;
  /** Free text over customer email, description and order number. */
  search?: string | null;
}

export abstract class CustomPaymentLinkRepository {
  abstract create(
    data: Omit<CustomPaymentLink, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CustomPaymentLink>;

  /** Newest first, with the total so the admin history can be paged (#084). */
  abstract findAllWithPagination({
    paginationOptions,
    filterOptions,
  }: {
    paginationOptions: IPaginationOptions;
    filterOptions?: CustomPaymentLinkFilter | null;
  }): Promise<[CustomPaymentLink[], number]>;

  abstract findById(
    id: CustomPaymentLink['id'],
  ): Promise<NullableType<CustomPaymentLink>>;

  abstract findByIds(
    ids: CustomPaymentLink['id'][],
  ): Promise<CustomPaymentLink[]>;

  abstract findByVirtualOrderId(
    virtualOrderId: string,
  ): Promise<NullableType<CustomPaymentLink>>;

  abstract update(
    id: CustomPaymentLink['id'],
    payload: DeepPartial<CustomPaymentLink>,
  ): Promise<CustomPaymentLink | null>;

  abstract remove(id: CustomPaymentLink['id']): Promise<void>;
}
