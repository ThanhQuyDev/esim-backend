import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterOrderDto, SortOrderDto } from './dto/query-order.dto';
import { OrderRepository } from './infrastructure/persistence/order.repository';
import { Order } from './domain/order';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class OrdersService {
  constructor(private readonly orderRepository: OrderRepository) {}

  create(createOrderDto: CreateOrderDto): Promise<Order> {
    return this.orderRepository.create({
      userId: createOrderDto.userId,
      orderNumber: createOrderDto.orderNumber,
      status: createOrderDto.status ?? 'pending',
      totalAmount: createOrderDto.totalAmount,
      currency: createOrderDto.currency,
      paymentMethod: createOrderDto.paymentMethod,
      paymentId: createOrderDto.paymentId,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderDto | null;
    sortOptions?: SortOrderDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Order[]> {
    return this.orderRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Order['id']): Promise<NullableType<Order>> {
    return this.orderRepository.findById(id);
  }

  async update(
    id: Order['id'],
    updateOrderDto: UpdateOrderDto,
  ): Promise<Order | null> {
    return this.orderRepository.update(id, {
      ...(updateOrderDto.userId !== undefined && {
        userId: updateOrderDto.userId,
      }),
      ...(updateOrderDto.orderNumber !== undefined && {
        orderNumber: updateOrderDto.orderNumber,
      }),
      ...(updateOrderDto.status !== undefined && {
        status: updateOrderDto.status,
      }),
      ...(updateOrderDto.totalAmount !== undefined && {
        totalAmount: updateOrderDto.totalAmount,
      }),
      ...(updateOrderDto.currency !== undefined && {
        currency: updateOrderDto.currency,
      }),
      ...(updateOrderDto.paymentMethod !== undefined && {
        paymentMethod: updateOrderDto.paymentMethod,
      }),
      ...(updateOrderDto.paymentId !== undefined && {
        paymentId: updateOrderDto.paymentId,
      }),
    });
  }

  async remove(id: Order['id']): Promise<void> {
    await this.orderRepository.remove(id);
  }
}
