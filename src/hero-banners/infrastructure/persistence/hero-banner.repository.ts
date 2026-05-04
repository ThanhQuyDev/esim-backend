import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { HeroBanner } from '../../domain/hero-banner';

export abstract class HeroBannerRepository {
  abstract create(
    data: Omit<HeroBanner, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<HeroBanner>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<HeroBanner[]>;

  abstract findById(id: HeroBanner['id']): Promise<NullableType<HeroBanner>>;

  abstract findByIds(ids: HeroBanner['id'][]): Promise<HeroBanner[]>;

  abstract update(
    id: HeroBanner['id'],
    payload: DeepPartial<HeroBanner>,
  ): Promise<HeroBanner | null>;

  abstract remove(id: HeroBanner['id']): Promise<void>;
}
