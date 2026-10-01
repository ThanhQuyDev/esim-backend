import { Injectable } from '@nestjs/common';
import { CreateSiteScriptDto } from './dto/create-site-script.dto';
import { UpdateSiteScriptDto } from './dto/update-site-script.dto';
import { SiteScriptRepository } from './infrastructure/persistence/site-script.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { SiteScript } from './domain/site-script';
import {
  DEFAULT_SITE_SCRIPT_PLACEMENT,
  SITE_SCRIPT_PLACEMENTS,
  SiteScriptPlacement,
} from './site-script-placements';

/** Active snippets split by where they go, the shape the storefront renders. */
export type SiteScriptsByPlacement = Record<SiteScriptPlacement, SiteScript[]>;

@Injectable()
export class SiteScriptsService {
  constructor(private readonly siteScriptRepository: SiteScriptRepository) {}

  async create(createSiteScriptDto: CreateSiteScriptDto) {
    return this.siteScriptRepository.create({
      name: createSiteScriptDto.name,
      content: createSiteScriptDto.content,
      placement: createSiteScriptDto.placement ?? DEFAULT_SITE_SCRIPT_PLACEMENT,
      isActive: createSiteScriptDto.isActive ?? true,
      sortOrder: createSiteScriptDto.sortOrder ?? 0,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.siteScriptRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  /**
   * What every page asks for: the active snippets, grouped by placement and in
   * render order. Both placements are always present so the storefront never has
   * to guard against a missing key.
   */
  async findActiveByPlacement(): Promise<SiteScriptsByPlacement> {
    const scripts = await this.siteScriptRepository.findActive();

    const grouped = Object.fromEntries(
      SITE_SCRIPT_PLACEMENTS.map((key) => [key, [] as SiteScript[]]),
    ) as SiteScriptsByPlacement;

    for (const script of scripts) {
      // An unrecognised placement (hand-edited row) falls back to the head rather
      // than being dropped: the snippet was put there to run.
      const placement = (
        script.placement in grouped
          ? script.placement
          : DEFAULT_SITE_SCRIPT_PLACEMENT
      ) as SiteScriptPlacement;
      grouped[placement].push(script);
    }

    return grouped;
  }

  findById(id: SiteScript['id']) {
    return this.siteScriptRepository.findById(id);
  }

  async update(id: SiteScript['id'], updateSiteScriptDto: UpdateSiteScriptDto) {
    return this.siteScriptRepository.update(id, {
      name: updateSiteScriptDto.name,
      content: updateSiteScriptDto.content,
      placement: updateSiteScriptDto.placement,
      isActive: updateSiteScriptDto.isActive,
      sortOrder: updateSiteScriptDto.sortOrder,
    });
  }

  remove(id: SiteScript['id']) {
    return this.siteScriptRepository.remove(id);
  }
}
