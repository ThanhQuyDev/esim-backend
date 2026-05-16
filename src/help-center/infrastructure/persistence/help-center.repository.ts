import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { HelpCenter } from '../../domain/help-center';
import {
  FilterHelpCenterDto,
  SortHelpCenterDto,
} from '../../dto/find-all-help-center.dto';

export abstract class HelpCenterRepository {
  abstract create(
    data: Omit<HelpCenter, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<HelpCenter>;

  abstract findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterHelpCenterDto | null;
    sortOptions?: SortHelpCenterDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[HelpCenter[], number]>;

  abstract findById(id: HelpCenter['id']): Promise<NullableType<HelpCenter>>;

  abstract findByIds(ids: HelpCenter['id'][]): Promise<HelpCenter[]>;

  abstract update(
    id: HelpCenter['id'],
    payload: DeepPartial<HelpCenter>,
  ): Promise<HelpCenter | null>;

  abstract remove(id: HelpCenter['id']): Promise<void>;
}
