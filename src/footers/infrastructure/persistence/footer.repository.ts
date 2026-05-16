import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Footer } from '../../domain/footer';
import { FilterFooterDto, SortFooterDto } from '../../dto/find-all-footers.dto';

export abstract class FooterRepository {
  abstract create(
    data: Omit<Footer, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Footer>;

  abstract findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterFooterDto | null;
    sortOptions?: SortFooterDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Footer[], number]>;

  abstract findById(id: Footer['id']): Promise<NullableType<Footer>>;

  abstract findByIds(ids: Footer['id'][]): Promise<Footer[]>;

  abstract update(
    id: Footer['id'],
    payload: DeepPartial<Footer>,
  ): Promise<Footer | null>;

  abstract remove(id: Footer['id']): Promise<void>;
}
