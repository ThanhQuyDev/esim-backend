import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { CustomPaymentLink } from '../../domain/custom-payment-link';

export abstract class CustomPaymentLinkRepository {
  abstract create(
    data: Omit<CustomPaymentLink, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CustomPaymentLink>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<CustomPaymentLink[]>;

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
