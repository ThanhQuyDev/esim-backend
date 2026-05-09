import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { OrderItemEntity } from '../entities/order-item.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  FilterOrderItemDto,
  SortOrderItemDto,
} from '../../../../dto/query-order-item.dto';
import { OrderItem } from '../../../../domain/order-item';
import { OrderItemRepository } from '../../order-item.repository';
import { OrderItemMapper } from '../mappers/order-item.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class OrderItemsRelationalRepository implements OrderItemRepository {
  constructor(
    @InjectRepository(OrderItemEntity)
    private readonly orderItemsRepository: Repository<OrderItemEntity>,
  ) {}

  async create(data: OrderItem): Promise<OrderItem> {
    const persistenceModel = OrderItemMapper.toPersistence(data);
    const newEntity = await this.orderItemsRepository.save(
      this.orderItemsRepository.create(persistenceModel),
    );
    return OrderItemMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderItemDto | null;
    sortOptions?: SortOrderItemDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<OrderItem[]> {
    const where: FindOptionsWhere<OrderItemEntity> = {};

    if (filterOptions?.orderId !== undefined) {
      where.orderId = filterOptions.orderId;
    }
    if (filterOptions?.planId !== undefined) {
      where.planId = filterOptions.planId;
    }

    const entities = await this.orderItemsRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.length
        ? sortOptions.reduce(
            (accumulator, sort) => ({
              ...accumulator,
              [sort.orderBy]: sort.order,
            }),
            {},
          )
        : { createdAt: 'DESC' },
    });

    return entities.map((entity) => OrderItemMapper.toDomain(entity));
  }

  async findById(id: OrderItem['id']): Promise<NullableType<OrderItem>> {
    const entity = await this.orderItemsRepository.findOne({
      where: { id: Number(id) },
    });
    return entity ? OrderItemMapper.toDomain(entity) : null;
  }

  async findByOrderId(orderId: number): Promise<OrderItem[]> {
    const entities = await this.orderItemsRepository.find({
      where: { orderId },
    });
    return entities.map((e) => OrderItemMapper.toDomain(e));
  }

  async update(
    id: OrderItem['id'],
    payload: Partial<OrderItem>,
  ): Promise<OrderItem> {
    const entity = await this.orderItemsRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('OrderItem not found');
    }

    const updatedEntity = await this.orderItemsRepository.save(
      this.orderItemsRepository.create(
        OrderItemMapper.toPersistence({
          ...OrderItemMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return OrderItemMapper.toDomain(updatedEntity);
  }

  async findByOrderRequestId(orderRequestId: string): Promise<OrderItem[]> {
    const entities = await this.orderItemsRepository.find({
      where: { orderRequestId },
      relations: ['plan'],
    });
    return entities.map((e) => OrderItemMapper.toDomain(e));
  }

  async findPendingByProvider(provider: string): Promise<OrderItem[]> {
    const entities = await this.orderItemsRepository.find({
      where: {
        status: 'pending',
        plan: { provider },
      },
      relations: ['plan'],
      order: { id: 'ASC' },
      take: 100,
    });
    return entities.map((e) => OrderItemMapper.toDomain(e));
  }

  async remove(id: OrderItem['id']): Promise<void> {
    await this.orderItemsRepository.delete(id);
  }
}
