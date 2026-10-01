import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateSeoConfigDto } from './dto/create-seo-config.dto';
import { UpdateSeoConfigDto } from './dto/update-seo-config.dto';
import { NullableType } from '../utils/types/nullable.type';
import {
  FilterSeoConfigDto,
  SortSeoConfigDto,
} from './dto/query-seo-config.dto';
import { SeoConfigRepository } from './infrastructure/persistence/seo-config.repository';
import { SeoConfig } from './domain/seo-config';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { DestinationsService } from '../destinations/destinations.service';
import { RegionsService } from '../regions/regions.service';
import { seoUrlSlug } from './seo-config-page-target';

@Injectable()
export class SeoConfigsService {
  constructor(
    private readonly seoConfigsRepository: SeoConfigRepository,
    private readonly destinationsService: DestinationsService,
    private readonly regionsService: RegionsService,
  ) {}

  async create(createSeoConfigDto: CreateSeoConfigDto): Promise<SeoConfig> {
    const existingByUrl = await this.seoConfigsRepository.findByUrl(
      createSeoConfigDto.url,
    );
    if (existingByUrl) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          url: 'urlAlreadyExists',
        },
      });
    }

    // Link the config to the page it is plainly for, when the admin typed only a
    // URL (#048). Without this the row keeps all three ids null and the list
    // labels a country page "Trang khác".
    const inferred = await this.inferPageTarget(createSeoConfigDto.url, {
      destinationId: createSeoConfigDto.destinationId,
      regionId: createSeoConfigDto.regionId,
      planId: createSeoConfigDto.planId,
    });

    return this.seoConfigsRepository.create({
      url: createSeoConfigDto.url,
      metaTitle: createSeoConfigDto.metaTitle ?? null,
      metaDescription: createSeoConfigDto.metaDescription ?? null,
      metaKeywords: createSeoConfigDto.metaKeywords ?? null,
      ogImage: createSeoConfigDto.ogImage ?? null,
      ogTitle: createSeoConfigDto.ogTitle ?? null,
      ogDescription: createSeoConfigDto.ogDescription ?? null,
      structuredData: createSeoConfigDto.structuredData ?? null,
      destinationId: createSeoConfigDto.destinationId ?? inferred.destinationId,
      regionId: createSeoConfigDto.regionId ?? inferred.regionId,
      planId: createSeoConfigDto.planId ?? null,
      isActive: createSeoConfigDto.isActive ?? true,
    });
  }

  /**
   * The destination or region a SEO url is for, when nothing was picked by hand
   * (#048).
   *
   * A destination and a region detail page are both single-segment slugs on the
   * storefront, so the slug has to be looked up to tell them apart. An explicit
   * id always wins — an admin pointing a config somewhere unusual on purpose must
   * not be overridden — and the shared `/destination` and `/region` pages are left
   * unlinked, since they are about a kind of page rather than one country.
   */
  private async inferPageTarget(
    url: string,
    picked: {
      destinationId?: number | null;
      regionId?: number | null;
      planId?: number | null;
    },
  ): Promise<{ destinationId: number | null; regionId: number | null }> {
    const empty = { destinationId: null, regionId: null };

    const alreadyLinked =
      picked.destinationId != null ||
      picked.regionId != null ||
      picked.planId != null;
    if (alreadyLinked) return empty;

    const slug = seoUrlSlug(url);
    if (!slug) return empty;

    const destination = await this.destinationsService.findBySlug(slug);
    if (destination)
      return { destinationId: Number(destination.id), regionId: null };

    const region = await this.regionsService.findBySlug(slug);
    if (region) return { destinationId: null, regionId: Number(region.id) };

    return empty;
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterSeoConfigDto | null;
    sortOptions?: SortSeoConfigDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[SeoConfig[], number]> {
    return this.seoConfigsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: SeoConfig['id']): Promise<NullableType<SeoConfig>> {
    return this.seoConfigsRepository.findById(id);
  }

  /**
   * Lookup endpoint behavior: returns the most specific ancestor SEO config
   * for the given URL (e.g. `/destination/vietnam` falls back to
   * `/destination` then `/` when no exact record exists).
   */
  findByUrl(url: SeoConfig['url']): Promise<NullableType<SeoConfig>> {
    return this.seoConfigsRepository.findByUrlWithFallback(url);
  }

  async update(
    id: SeoConfig['id'],
    updateSeoConfigDto: UpdateSeoConfigDto,
  ): Promise<SeoConfig | null> {
    if (updateSeoConfigDto.url) {
      const existingByUrl = await this.seoConfigsRepository.findByUrl(
        updateSeoConfigDto.url,
      );
      if (existingByUrl && existingByUrl.id !== Number(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            url: 'urlAlreadyExists',
          },
        });
      }
    }

    // A config that is still unlinked picks up its destination / region when the
    // URL is edited, so fixing a typo is enough to correct its Loại trang (#048).
    // An existing link is never touched here.
    const current = await this.seoConfigsRepository.findById(id);
    const inferred =
      updateSeoConfigDto.url && current
        ? await this.inferPageTarget(updateSeoConfigDto.url, {
            destinationId:
              updateSeoConfigDto.destinationId ?? current.destinationId,
            regionId: updateSeoConfigDto.regionId ?? current.regionId,
            planId: updateSeoConfigDto.planId ?? current.planId,
          })
        : { destinationId: null, regionId: null };

    return this.seoConfigsRepository.update(id, {
      url: updateSeoConfigDto.url,
      metaTitle: updateSeoConfigDto.metaTitle,
      metaDescription: updateSeoConfigDto.metaDescription,
      metaKeywords: updateSeoConfigDto.metaKeywords,
      ogImage: updateSeoConfigDto.ogImage,
      ogTitle: updateSeoConfigDto.ogTitle,
      ogDescription: updateSeoConfigDto.ogDescription,
      structuredData: updateSeoConfigDto.structuredData,
      destinationId:
        updateSeoConfigDto.destinationId ?? inferred.destinationId ?? undefined,
      regionId: updateSeoConfigDto.regionId ?? inferred.regionId ?? undefined,
      planId: updateSeoConfigDto.planId,
      isActive: updateSeoConfigDto.isActive,
    });
  }

  async remove(id: SeoConfig['id']): Promise<void> {
    await this.seoConfigsRepository.remove(id);
  }

  /** Turn many configs on or off at once (#049). */
  async bulkSetActive(
    ids: SeoConfig['id'][],
    isActive: boolean,
  ): Promise<{ updated: number }> {
    const updated = await this.seoConfigsRepository.bulkSetActive(
      ids,
      isActive,
    );
    return { updated };
  }

  /** Soft-delete many configs at once (#049). */
  async bulkRemove(ids: SeoConfig['id'][]): Promise<{ deleted: number }> {
    const deleted = await this.seoConfigsRepository.bulkRemove(ids);
    return { deleted };
  }

  /**
   * Remove the configs of pages that no longer exist, e.g. a deleted blog
   * post (#055). Exact URLs only — never an ancestor like `/blog`.
   */
  removeByUrls(urls: SeoConfig['url'][]): Promise<number> {
    return this.seoConfigsRepository.removeByUrls(urls);
  }
}
