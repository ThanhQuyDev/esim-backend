import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { WhyChooseUs } from '../../domain/why-choose-us';
import {
  FilterWhyChooseUsDto,
  SortWhyChooseUsDto,
} from '../../dto/find-all-why-choose-us.dto';

export abstract class WhyChooseUsRepository {
  abstract create(
    data: Omit<WhyChooseUs, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WhyChooseUs>;

  abstract findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterWhyChooseUsDto | null;
    sortOptions?: SortWhyChooseUsDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[WhyChooseUs[], number]>;

  abstract findById(id: WhyChooseUs['id']): Promise<NullableType<WhyChooseUs>>;

  abstract findByIds(ids: WhyChooseUs['id'][]): Promise<WhyChooseUs[]>;

  abstract update(
    id: WhyChooseUs['id'],
    payload: DeepPartial<WhyChooseUs>,
  ): Promise<WhyChooseUs | null>;

  abstract remove(id: WhyChooseUs['id']): Promise<void>;
}
