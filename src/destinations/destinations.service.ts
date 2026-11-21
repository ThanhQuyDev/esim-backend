import { normaliseNoticeHtml } from '../utils/notice-html';
import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { NullableType } from '../utils/types/nullable.type';
import {
  FilterDestinationDto,
  SortDestinationDto,
} from './dto/query-destination.dto';
import { DestinationRepository } from './infrastructure/persistence/destination.repository';
import { Destination } from './domain/destination';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { domesticProviderOf } from '../plans/domestic-provider';

/**
 * A local destination's supplier as its plans carry it, "vietnamobile-noidia";
 * a travel one has none (vande-1411 #025).
 */
export function localProviderOf(
  esimType: string | undefined,
  provider: string | null | undefined,
): string | null {
  if (esimType !== 'local' || !provider?.trim()) return null;
  return domesticProviderOf(provider);
}

@Injectable()
export class DestinationsService {
  constructor(private readonly destinationsRepository: DestinationRepository) {}

  async create(
    createDestinationDto: CreateDestinationDto,
  ): Promise<Destination> {
    const existingBySlug = await this.destinationsRepository.findBySlug(
      createDestinationDto.slug,
    );
    if (existingBySlug) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          slug: 'slugAlreadyExists',
        },
      });
    }

    if (createDestinationDto.slugVi) {
      const existingBySlugVi = await this.destinationsRepository.findBySlug(
        createDestinationDto.slugVi,
      );
      if (existingBySlugVi) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            slugVi: 'slugAlreadyExists',
          },
        });
      }
    }

    return this.destinationsRepository.create({
      name: createDestinationDto.name,
      slug: createDestinationDto.slug,
      slugVi: createDestinationDto.slugVi ?? null,
      countryCode: createDestinationDto.countryCode,
      parentId: createDestinationDto.parentId ?? null,
      flagUrl: createDestinationDto.flagUrl ?? null,
      avatarUrl: createDestinationDto.avatarUrl ?? null,
      keySearch: createDestinationDto.keySearch ?? null,
      isPopular: createDestinationDto.isPopular ?? false,
      mobileHomeRank: createDestinationDto.mobileHomeRank ?? null,
      esimType: createDestinationDto.esimType ?? 'travel',
      localProvider: localProviderOf(
        createDestinationDto.esimType,
        createDestinationDto.localProvider,
      ),
      isActive: createDestinationDto.isActive ?? true,
      description: createDestinationDto.description ?? null,
      descriptionVi: createDestinationDto.descriptionVi ?? null,
      title: createDestinationDto.title ?? null,
      titleVi: createDestinationDto.titleVi ?? null,
      notice: normaliseNoticeHtml(createDestinationDto.notice) ?? null,
      noticeVi: normaliseNoticeHtml(createDestinationDto.noticeVi) ?? null,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterDestinationDto | null;
    sortOptions?: SortDestinationDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Destination[], number]> {
    return this.destinationsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Destination['id']): Promise<NullableType<Destination>> {
    return this.destinationsRepository.findById(id);
  }

  /**
   * For the public `slug/:slug` lookup: also answers to a slug the page had
   * before the English rename (vande-2011 #015), returning the page itself,
   * so the storefront redirects the old link to the current one.
   */
  async findBySlugOrFormer(slug: string) {
    const found = await this.destinationsRepository.findBySlug(slug);
    if (found) return found;
    const current = await this.destinationsRepository.findRenamedSlug(slug);
    return current ? this.destinationsRepository.findBySlug(current) : null;
  }

  findBySlug(slug: Destination['slug']): Promise<NullableType<Destination>> {
    return this.destinationsRepository.findBySlug(slug);
  }

  findByCountryCode(
    countryCode: Destination['countryCode'],
  ): Promise<NullableType<Destination>> {
    return this.destinationsRepository.findByCountryCode(countryCode);
  }

  findByName(name: Destination['name']): Promise<NullableType<Destination>> {
    return this.destinationsRepository.findByName(name);
  }

  async update(
    id: Destination['id'],
    updateDestinationDto: UpdateDestinationDto,
  ): Promise<Destination | null> {
    if (updateDestinationDto.slug) {
      const existingBySlug = await this.destinationsRepository.findBySlug(
        updateDestinationDto.slug,
      );
      if (existingBySlug && existingBySlug.id !== Number(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            slug: 'slugAlreadyExists',
          },
        });
      }
    }

    if (updateDestinationDto.slugVi) {
      const existingBySlugVi = await this.destinationsRepository.findBySlug(
        updateDestinationDto.slugVi,
      );
      if (existingBySlugVi && existingBySlugVi.id !== Number(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            slugVi: 'slugAlreadyExists',
          },
        });
      }
    }

    return this.destinationsRepository.update(id, {
      name: updateDestinationDto.name,
      slug: updateDestinationDto.slug,
      slugVi: updateDestinationDto.slugVi,
      countryCode: updateDestinationDto.countryCode,
      parentId: updateDestinationDto.parentId,
      flagUrl: updateDestinationDto.flagUrl,
      avatarUrl: updateDestinationDto.avatarUrl,
      keySearch: updateDestinationDto.keySearch,
      isPopular: updateDestinationDto.isPopular,
      // Only when sent, so a save that leaves it out keeps it (vande-1411 #021).
      ...(updateDestinationDto.mobileHomeRank !== undefined && {
        mobileHomeRank: updateDestinationDto.mobileHomeRank,
      }),
      ...(updateDestinationDto.esimType !== undefined && {
        esimType: updateDestinationDto.esimType,
        localProvider: localProviderOf(
          updateDestinationDto.esimType,
          updateDestinationDto.localProvider,
        ),
      }),
      isActive: updateDestinationDto.isActive,
      description: updateDestinationDto.description,
      descriptionVi: updateDestinationDto.descriptionVi,
      title: updateDestinationDto.title,
      titleVi: updateDestinationDto.titleVi,
      notice: normaliseNoticeHtml(updateDestinationDto.notice),
      noticeVi: normaliseNoticeHtml(updateDestinationDto.noticeVi),
    });
  }

  async addRegion(
    destinationId: Destination['id'],
    regionId: number,
  ): Promise<void> {
    await this.destinationsRepository.addRegion(destinationId, regionId);
  }

  async updateProviders(
    id: Destination['id'],
    providers: string | null,
  ): Promise<void> {
    await this.destinationsRepository.update(id, { providers } as any);
  }

  async remove(id: Destination['id']): Promise<void> {
    await this.destinationsRepository.remove(id);
  }
}
