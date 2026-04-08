import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Order } from '../../domain/order';
import { FilterOrderDto, SortOrderDto } from '../../dto/query-order.dto';

export abstract class OrderRepository {
  abstract create(
    data: Omit<Order, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
  ): Promise<Order>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderDto | null;
    sortOptions?: SortOrderDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Order[]>;

  abstract findById(id: Order['id']): Promise<NullableType<Order>>;

  abstract update(
    id: Order['id'],
    payload: DeepPartial<Order>,
  ): Promise<Order | null>;

  abstract remove(id: Order['id']): Promise<void>;
}
