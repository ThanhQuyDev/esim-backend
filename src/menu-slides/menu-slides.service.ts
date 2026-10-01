import { Injectable } from '@nestjs/common';
import { CreateMenuSlideDto } from './dto/create-menu-slide.dto';
import { UpdateMenuSlideDto } from './dto/update-menu-slide.dto';
import { MenuSlideRepository } from './infrastructure/persistence/menu-slide.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MenuSlide } from './domain/menu-slide';
import { MENU_SLIDE_KEYS, MenuSlideKey } from './menu-slide-keys';

/** Slides grouped by the panel they belong to, the shape the navbar renders. */
export type GroupedMenuSlides = Record<MenuSlideKey, MenuSlide[]>;

@Injectable()
export class MenuSlidesService {
  constructor(private readonly menuSlideRepository: MenuSlideRepository) {}

  async create(createMenuSlideDto: CreateMenuSlideDto) {
    return this.menuSlideRepository.create({
      menuKey: createMenuSlideDto.menuKey,
      title: createMenuSlideDto.title,
      description: createMenuSlideDto.description,
      href: createMenuSlideDto.href,
      image: createMenuSlideDto.image,
      imageAlt: createMenuSlideDto.imageAlt ?? null,
      language: createMenuSlideDto.language,
      sortOrder: createMenuSlideDto.sortOrder ?? 0,
      isActive: createMenuSlideDto.isActive ?? true,
    });
  }

  findAllWithPagination({
    paginationOptions,
    lang,
    menuKey,
  }: {
    paginationOptions: IPaginationOptions;
    lang?: string;
    menuKey?: string;
  }) {
    return this.menuSlideRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      lang,
      menuKey,
    });
  }

  /**
   * What the navbar asks for: every active slide for one language, already split
   * by panel. Every panel is present even when empty, so the storefront can tell
   * "nothing configured yet" from "this panel has slides" without guessing.
   */
  async findGrouped(lang?: string): Promise<GroupedMenuSlides> {
    const slides = await this.menuSlideRepository.findActiveForMenus(lang);

    const grouped = Object.fromEntries(
      MENU_SLIDE_KEYS.map((key) => [key, [] as MenuSlide[]]),
    ) as GroupedMenuSlides;

    for (const slide of slides) {
      // A key that is no longer a panel (renamed menu, stale row) is skipped
      // rather than creating a group nothing renders.
      if (slide.menuKey in grouped) {
        grouped[slide.menuKey as MenuSlideKey].push(slide);
      }
    }

    return grouped;
  }

  findById(id: MenuSlide['id']) {
    return this.menuSlideRepository.findById(id);
  }

  async update(id: MenuSlide['id'], updateMenuSlideDto: UpdateMenuSlideDto) {
    return this.menuSlideRepository.update(id, {
      menuKey: updateMenuSlideDto.menuKey,
      title: updateMenuSlideDto.title,
      description: updateMenuSlideDto.description,
      href: updateMenuSlideDto.href,
      image: updateMenuSlideDto.image,
      imageAlt: updateMenuSlideDto.imageAlt,
      language: updateMenuSlideDto.language,
      sortOrder: updateMenuSlideDto.sortOrder,
      isActive: updateMenuSlideDto.isActive,
    });
  }

  remove(id: MenuSlide['id']) {
    return this.menuSlideRepository.remove(id);
  }
}
