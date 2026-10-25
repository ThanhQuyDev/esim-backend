import { normaliseNoticeHtml } from '../utils/notice-html';
import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterRegionDto, SortRegionDto } from './dto/query-region.dto';
import { RegionRepository } from './infrastructure/persistence/region.repository';
import { Region } from './domain/region';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class RegionsService {
  constructor(private readonly regionsRepository: RegionRepository) {}

  async create(createRegionDto: CreateRegionDto): Promise<Region> {
    const existingBySlug = await this.regionsRepository.findBySlug(
      createRegionDto.slug,
    );
    if (existingBySlug) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { slug: 'slugAlreadyExists' },
      });
    }

    if (createRegionDto.slugVi) {
      const existingBySlugVi = await this.regionsRepository.findBySlug(
        createRegionDto.slugVi,
      );
      if (existingBySlugVi) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { slugVi: 'slugAlreadyExists' },
        });
      }
    }

    if (createRegionDto.externalCode) {
      const existingByExternalCode =
        await this.regionsRepository.findByExternalCode(
          createRegionDto.externalCode,
        );
      if (existingByExternalCode) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { externalCode: 'externalCodeAlreadyExists' },
        });
      }
    }

    await this.assertParent(null, createRegionDto.parentId);

    return this.regionsRepository.create(
      {
        name: createRegionDto.name,
        slug: createRegionDto.slug,
        slugVi: createRegionDto.slugVi ?? null,
        externalCode: createRegionDto.externalCode ?? null,
        avatarUrl: createRegionDto.avatarUrl ?? null,
        iconUrl: createRegionDto.iconUrl ?? null,
        description: createRegionDto.description ?? null,
        descriptionVi: createRegionDto.descriptionVi ?? null,
        title: createRegionDto.title ?? null,
        titleVi: createRegionDto.titleVi ?? null,
        notice: normaliseNoticeHtml(createRegionDto.notice) ?? null,
        noticeVi: normaliseNoticeHtml(createRegionDto.noticeVi) ?? null,
        providers: createRegionDto.providers ?? null,
        isActive: createRegionDto.isActive ?? true,
        isPopular: createRegionDto.isPopular ?? false,
        parentId: createRegionDto.parentId ?? null,
      },
      createRegionDto.destinationIds,
    );
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterRegionDto | null;
    sortOptions?: SortRegionDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Region[], number]> {
    return this.regionsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Region['id']): Promise<NullableType<Region>> {
    return this.regionsRepository.findById(id);
  }

  findBySlug(slug: Region['slug']): Promise<NullableType<Region>> {
    return this.regionsRepository.findBySlug(slug);
  }

  findByName(name: Region['name']): Promise<NullableType<Region>> {
    return this.regionsRepository.findByName(name);
  }

  findByExternalCode(externalCode: string): Promise<NullableType<Region>> {
    return this.regionsRepository.findByExternalCode(externalCode);
  }

  async update(
    id: Region['id'],
    updateRegionDto: UpdateRegionDto,
  ): Promise<Region | null> {
    if (updateRegionDto.slug) {
      const existingBySlug = await this.regionsRepository.findBySlug(
        updateRegionDto.slug,
      );
      if (existingBySlug && existingBySlug.id !== Number(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { slug: 'slugAlreadyExists' },
        });
      }
    }

    if (updateRegionDto.slugVi) {
      const existingBySlugVi = await this.regionsRepository.findBySlug(
        updateRegionDto.slugVi,
      );
      if (existingBySlugVi && existingBySlugVi.id !== Number(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { slugVi: 'slugAlreadyExists' },
        });
      }
    }

    await this.assertParent(Number(id), updateRegionDto.parentId);

    return this.regionsRepository.update(
      id,
      {
        name: updateRegionDto.name,
        slug: updateRegionDto.slug,
        slugVi: updateRegionDto.slugVi,
        avatarUrl: updateRegionDto.avatarUrl,
        iconUrl: updateRegionDto.iconUrl,
        description: updateRegionDto.description,
        descriptionVi: updateRegionDto.descriptionVi,
        title: updateRegionDto.title,
        titleVi: updateRegionDto.titleVi,
        notice: normaliseNoticeHtml(updateRegionDto.notice),
        noticeVi: normaliseNoticeHtml(updateRegionDto.noticeVi),
        providers: updateRegionDto.providers,
        isActive: updateRegionDto.isActive,
        isPopular: updateRegionDto.isPopular,
        parentId: updateRegionDto.parentId,
      },
      updateRegionDto.destinationIds,
    );
  }

  /**
   * "Khu vực cha" (vande #035) is one level deep: the parent must exist, not be
   * the region itself, and not have a parent of its own; and a region that is
   * already some region's parent cannot be put under another.
   */
  private async assertParent(
    id: number | null,
    parentId: number | null | undefined,
  ): Promise<void> {
    if (parentId === undefined || parentId === null) return;
    const fail = (reason: string) => {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { parentId: reason },
      });
    };
    if (id !== null && Number(parentId) === id) fail('parentIsSelf');
    const parent = await this.regionsRepository.findById(parentId);
    if (!parent) fail('parentNotFound');
    if (parent?.parentId) fail('parentHasParent');
    if (id !== null && (await this.regionsRepository.hasChildren(id))) {
      fail('regionHasChildren');
    }
  }

  async updateProviders(
    id: Region['id'],
    providers: string | null,
  ): Promise<void> {
    await this.regionsRepository.update(id, { providers } as any);
  }

  async remove(id: Region['id']): Promise<void> {
    await this.regionsRepository.remove(id);
  }
}
