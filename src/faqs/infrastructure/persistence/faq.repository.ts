import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Faq } from '../../domain/faq';
import { FilterFaqDto } from '../../dto/find-all-faqs.dto';

export abstract class FaqRepository {
  abstract create(
    data: Omit<Faq, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Faq>;

  abstract findAllWithPagination({
    paginationOptions,
    filterOptions,
  }: {
    paginationOptions: IPaginationOptions;
    filterOptions?: FilterFaqDto | null;
  }): Promise<[Faq[], number]>;

  abstract findById(id: Faq['id']): Promise<NullableType<Faq>>;

  abstract findByIds(ids: Faq['id'][]): Promise<Faq[]>;

  abstract findByUrlOrBlogId(options: {
    url?: string;
    blogId?: string;
    language?: string;
    limit?: number;
  }): Promise<Faq[]>;

  abstract update(
    id: Faq['id'],
    payload: DeepPartial<Faq>,
  ): Promise<Faq | null>;

  abstract remove(id: Faq['id']): Promise<void>;
}
