import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { HeroBanner } from '../../domain/hero-banner';
import {
  FilterHeroBannerDto,
  SortHeroBannerDto,
} from '../../dto/find-all-hero-banners.dto';

export abstract class HeroBannerRepository {
  abstract create(
    data: Omit<HeroBanner, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<HeroBanner>;

  abstract findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
    lang,
  }: {
    filterOptions?: FilterHeroBannerDto | null;
    sortOptions?: SortHeroBannerDto[] | null;
    paginationOptions: IPaginationOptions;
    lang?: string;
  }): Promise<[HeroBanner[], number]>;

  abstract findById(id: HeroBanner['id']): Promise<NullableType<HeroBanner>>;

  abstract findByIds(ids: HeroBanner['id'][]): Promise<HeroBanner[]>;

  abstract update(
    id: HeroBanner['id'],
    payload: Partial<HeroBanner>,
  ): Promise<HeroBanner | null>;

  abstract remove(id: HeroBanner['id']): Promise<void>;
}
