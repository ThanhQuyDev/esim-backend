import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Destination } from '../../domain/destination';
import {
  FilterDestinationDto,
  SortDestinationDto,
} from '../../dto/query-destination.dto';

export abstract class DestinationRepository {
  abstract create(
    data: Omit<Destination, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
  ): Promise<Destination>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterDestinationDto | null;
    sortOptions?: SortDestinationDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Destination[]>;

  abstract findById(
    id: Destination['id'],
  ): Promise<NullableType<Destination>>;

  abstract findBySlug(
    slug: Destination['slug'],
  ): Promise<NullableType<Destination>>;

  abstract findByCountryCode(
    countryCode: Destination['countryCode'],
  ): Promise<NullableType<Destination>>;

  abstract findByName(
    name: Destination['name'],
  ): Promise<NullableType<Destination>>;

  abstract update(
    id: Destination['id'],
    payload: DeepPartial<Destination>,
  ): Promise<Destination | null>;

  abstract addRegion(
    destinationId: Destination['id'],
    regionId: number,
  ): Promise<void>;

  abstract remove(id: Destination['id']): Promise<void>;
}
