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

    return this.destinationsRepository.create({
      name: createDestinationDto.name,
      slug: createDestinationDto.slug,
      countryCode: createDestinationDto.countryCode,
      flagUrl: createDestinationDto.flagUrl ?? null,
      avatarUrl: createDestinationDto.avatarUrl ?? null,
      keySearch: createDestinationDto.keySearch ?? null,
      isPopular: createDestinationDto.isPopular ?? false,
      isActive: createDestinationDto.isActive ?? true,
      description: createDestinationDto.description ?? null,
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
  }): Promise<Destination[]> {
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
      if (existingBySlug && existingBySlug.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            slug: 'slugAlreadyExists',
          },
        });
      }
    }

    return this.destinationsRepository.update(id, {
      name: updateDestinationDto.name,
      slug: updateDestinationDto.slug,
      countryCode: updateDestinationDto.countryCode,
      flagUrl: updateDestinationDto.flagUrl,
      avatarUrl: updateDestinationDto.avatarUrl,
      keySearch: updateDestinationDto.keySearch,
      isPopular: updateDestinationDto.isPopular,
      isActive: updateDestinationDto.isActive,
      description: updateDestinationDto.description,
    });
  }

  async addRegion(
    destinationId: Destination['id'],
    regionId: number,
  ): Promise<void> {
    await this.destinationsRepository.addRegion(destinationId, regionId);
  }

  async remove(id: Destination['id']): Promise<void> {
    await this.destinationsRepository.remove(id);
  }
}
