import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { SeoConfig } from '../../domain/seo-config';
import {
  FilterSeoConfigDto,
  SortSeoConfigDto,
} from '../../dto/query-seo-config.dto';

export abstract class SeoConfigRepository {
  abstract create(
    data: Omit<SeoConfig, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
  ): Promise<SeoConfig>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterSeoConfigDto | null;
    sortOptions?: SortSeoConfigDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<SeoConfig[]>;

  abstract findById(id: SeoConfig['id']): Promise<NullableType<SeoConfig>>;

  abstract findByUrl(url: SeoConfig['url']): Promise<NullableType<SeoConfig>>;

  abstract update(
    id: SeoConfig['id'],
    payload: DeepPartial<SeoConfig>,
  ): Promise<SeoConfig | null>;

  abstract remove(id: SeoConfig['id']): Promise<void>;
}
