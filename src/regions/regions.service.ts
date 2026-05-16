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

    return this.regionsRepository.create(
      {
        name: createRegionDto.name,
        slug: createRegionDto.slug,
        avatarUrl: createRegionDto.avatarUrl ?? null,
        iconUrl: createRegionDto.iconUrl ?? null,
        description: createRegionDto.description ?? null,
        descriptionVi: createRegionDto.descriptionVi ?? null,
        isActive: createRegionDto.isActive ?? true,
        isPopular: createRegionDto.isPopular ?? false,
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

    return this.regionsRepository.update(
      id,
      {
        name: updateRegionDto.name,
        slug: updateRegionDto.slug,
        avatarUrl: updateRegionDto.avatarUrl,
        iconUrl: updateRegionDto.iconUrl,
        description: updateRegionDto.description,
        descriptionVi: updateRegionDto.descriptionVi,
        isActive: updateRegionDto.isActive,
        isPopular: updateRegionDto.isPopular,
      },
      updateRegionDto.destinationIds,
    );
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
