import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { OrderItem } from '../../domain/order-item';
import {
  FilterOrderItemDto,
  SortOrderItemDto,
} from '../../dto/query-order-item.dto';

export abstract class OrderItemRepository {
  abstract create(
    data: Omit<OrderItem, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OrderItem>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderItemDto | null;
    sortOptions?: SortOrderItemDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[OrderItem[], number]>;

  abstract findById(id: OrderItem['id']): Promise<NullableType<OrderItem>>;

  abstract findByOrderId(orderId: number): Promise<OrderItem[]>;

  abstract countByOrderIds(orderIds: number[]): Promise<Map<number, number>>;

  /** Total eSIMs per order — quantities summed, not lines counted (#064). */
  abstract sumQuantityByOrderIds(
    orderIds: number[],
  ): Promise<Map<number, number>>;

  abstract findByOrderRequestId(orderRequestId: string): Promise<OrderItem[]>;

  abstract findPendingByProvider(provider: string): Promise<OrderItem[]>;

  /**
   * Lines of paid orders that a supplier never took (no request id, no eSIM),
   * for the automatic retry (vande #003). Only orders created after `since`
   * and lines asked fewer than `maxAttempts` times.
   */
  abstract findUnplacedForRetry(params: {
    providers: string[];
    since: Date;
    maxAttempts: number;
  }): Promise<(OrderItem & { provider: string })[]>;

  abstract update(
    id: OrderItem['id'],
    payload: DeepPartial<OrderItem>,
  ): Promise<OrderItem | null>;

  abstract remove(id: OrderItem['id']): Promise<void>;
}
