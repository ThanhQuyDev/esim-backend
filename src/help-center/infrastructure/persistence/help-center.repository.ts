import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import {
  HelpCenter,
  HelpCenterCategory,
  HelpCenterParent,
} from '../../domain/help-center';

export abstract class HelpCenterRepository {
  abstract create(
    data: Omit<HelpCenter, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<HelpCenter>;

  abstract findAllWithPagination({
    paginationOptions,
    category,
    parent,
  }: {
    paginationOptions: IPaginationOptions;
    category?: HelpCenterCategory;
    parent?: HelpCenterParent;
  }): Promise<HelpCenter[]>;

  abstract findById(id: HelpCenter['id']): Promise<NullableType<HelpCenter>>;

  abstract findByIds(ids: HelpCenter['id'][]): Promise<HelpCenter[]>;

  abstract update(
    id: HelpCenter['id'],
    payload: DeepPartial<HelpCenter>,
  ): Promise<HelpCenter | null>;

  abstract remove(id: HelpCenter['id']): Promise<void>;
}
