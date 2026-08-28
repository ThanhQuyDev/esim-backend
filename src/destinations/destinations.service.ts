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
      isActive: createDestinationDto.isActive ?? true,
      description: createDestinationDto.description ?? null,
      descriptionVi: createDestinationDto.descriptionVi ?? null,
      title: createDestinationDto.title ?? null,
      titleVi: createDestinationDto.titleVi ?? null,
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
      isActive: updateDestinationDto.isActive,
      description: updateDestinationDto.description,
      descriptionVi: updateDestinationDto.descriptionVi,
      title: updateDestinationDto.title,
      titleVi: updateDestinationDto.titleVi,
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
