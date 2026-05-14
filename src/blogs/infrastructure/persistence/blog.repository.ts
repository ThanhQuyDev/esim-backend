import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Blog } from '../../domain/blog';

export abstract class BlogRepository {
  abstract create(
    data: Omit<Blog, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Blog>;

  abstract findAllWithPagination({
    paginationOptions,
    category,
  }: {
    paginationOptions: IPaginationOptions;
    category?: string;
  }): Promise<[Blog[], number]>;

  abstract findById(id: Blog['id']): Promise<NullableType<Blog>>;

  abstract findBySlug(slug: string): Promise<NullableType<Blog>>;

  abstract findByIds(ids: Blog['id'][]): Promise<Blog[]>;

  abstract update(
    id: Blog['id'],
    payload: DeepPartial<Blog>,
  ): Promise<Blog | null>;

  abstract remove(id: Blog['id']): Promise<void>;

  abstract findCategories(): Promise<string[]>;
}
