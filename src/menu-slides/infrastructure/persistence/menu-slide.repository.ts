import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { MenuSlide } from '../../domain/menu-slide';

export abstract class MenuSlideRepository {
  abstract create(
    data: Omit<MenuSlide, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MenuSlide>;

  abstract findAllWithPagination({
    paginationOptions,
    lang,
    menuKey,
  }: {
    paginationOptions: IPaginationOptions;
    lang?: string;
    menuKey?: string;
  }): Promise<[MenuSlide[], number]>;

  /**
   * Every slide the storefront should show, in display order — one query for the
   * whole navbar rather than one per panel.
   */
  abstract findActiveForMenus(lang?: string): Promise<MenuSlide[]>;

  abstract findById(id: MenuSlide['id']): Promise<NullableType<MenuSlide>>;

  abstract update(
    id: MenuSlide['id'],
    payload: DeepPartial<MenuSlide>,
  ): Promise<MenuSlide | null>;

  abstract remove(id: MenuSlide['id']): Promise<void>;
}
