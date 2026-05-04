import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Footer } from '../../domain/footer';

export abstract class FooterRepository {
  abstract create(
    data: Omit<Footer, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Footer>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Footer[]>;

  abstract findById(id: Footer['id']): Promise<NullableType<Footer>>;

  abstract findByIds(ids: Footer['id'][]): Promise<Footer[]>;

  abstract update(
    id: Footer['id'],
    payload: DeepPartial<Footer>,
  ): Promise<Footer | null>;

  abstract remove(id: Footer['id']): Promise<void>;
}
