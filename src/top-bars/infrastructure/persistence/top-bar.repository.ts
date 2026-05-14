import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { TopBar } from '../../domain/top-bar';

export abstract class TopBarRepository {
  abstract create(
    data: Omit<TopBar, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TopBar>;

  abstract findAllWithPagination({
    paginationOptions,
    lang,
  }: {
    paginationOptions: IPaginationOptions;
    lang?: string;
  }): Promise<[TopBar[], number]>;

  abstract findById(id: TopBar['id']): Promise<NullableType<TopBar>>;

  abstract findByIds(ids: TopBar['id'][]): Promise<TopBar[]>;

  abstract update(
    id: TopBar['id'],
    payload: DeepPartial<TopBar>,
  ): Promise<TopBar | null>;

  abstract remove(id: TopBar['id']): Promise<void>;
}
