import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Region } from '../../domain/region';
import { FilterRegionDto, SortRegionDto } from '../../dto/query-region.dto';

export abstract class RegionRepository {
  abstract create(
    data: Omit<Region, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
  ): Promise<Region>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterRegionDto | null;
    sortOptions?: SortRegionDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Region[]>;

  abstract findById(id: Region['id']): Promise<NullableType<Region>>;

  abstract findBySlug(slug: Region['slug']): Promise<NullableType<Region>>;

  abstract update(
    id: Region['id'],
    payload: DeepPartial<Region>,
  ): Promise<Region | null>;

  abstract remove(id: Region['id']): Promise<void>;
}
