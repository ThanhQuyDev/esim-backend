import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Faq } from '../../domain/faq';

export abstract class FaqRepository {
  abstract create(
    data: Omit<Faq, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Faq>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<[Faq[], number]>;

  abstract findById(id: Faq['id']): Promise<NullableType<Faq>>;

  abstract findByIds(ids: Faq['id'][]): Promise<Faq[]>;

  abstract update(
    id: Faq['id'],
    payload: DeepPartial<Faq>,
  ): Promise<Faq | null>;

  abstract remove(id: Faq['id']): Promise<void>;
}
