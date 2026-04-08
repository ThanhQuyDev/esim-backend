import { Injectable } from '@nestjs/common';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterOrderItemDto, SortOrderItemDto } from './dto/query-order-item.dto';
import { OrderItemRepository } from './infrastructure/persistence/order-item.repository';
import { OrderItem } from './domain/order-item';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class OrderItemsService {
  constructor(private readonly orderItemsRepository: OrderItemRepository) {}

  async create(createOrderItemDto: CreateOrderItemDto): Promise<OrderItem> {
    return this.orderItemsRepository.create({
      orderId: createOrderItemDto.orderId,
      planId: createOrderItemDto.planId,
      planPriceId: createOrderItemDto.planPriceId,
      price: createOrderItemDto.price,
      currency: createOrderItemDto.currency,
      quantity: createOrderItemDto.quantity ?? 1,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderItemDto | null;
    sortOptions?: SortOrderItemDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<OrderItem[]> {
    return this.orderItemsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: OrderItem['id']): Promise<NullableType<OrderItem>> {
    return this.orderItemsRepository.findById(id);
  }

  async update(
    id: OrderItem['id'],
    updateOrderItemDto: UpdateOrderItemDto,
  ): Promise<OrderItem | null> {
    return this.orderItemsRepository.update(id, {
      orderId: updateOrderItemDto.orderId,
      planId: updateOrderItemDto.planId,
      planPriceId: updateOrderItemDto.planPriceId,
      price: updateOrderItemDto.price,
      currency: updateOrderItemDto.currency,
      quantity: updateOrderItemDto.quantity,
    });
  }

  async remove(id: OrderItem['id']): Promise<void> {
    await this.orderItemsRepository.remove(id);
  }
}
