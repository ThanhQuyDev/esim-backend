import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, LessThan, Repository } from 'typeorm';
import { OrderEntity } from '../entities/order.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterOrderDto, SortOrderDto } from '../../../../dto/query-order.dto';
import { Order } from '../../../../domain/order';
import { OrderRepository } from '../../order.repository';
import { OrderMapper } from '../mappers/order.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class OrdersRelationalRepository implements OrderRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly ordersRepository: Repository<OrderEntity>,
  ) {}

  async create(data: Partial<Order>): Promise<Order> {
    const persistenceModel = OrderMapper.toPersistence(data);
    const newEntity = await this.ordersRepository.save(
      this.ordersRepository.create(persistenceModel),
    );
    return OrderMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderDto | null;
    sortOptions?: SortOrderDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Order[]> {
    const where: FindOptionsWhere<OrderEntity> = {};

    if (filterOptions?.status) {
      if (Array.isArray(filterOptions.status)) {
        where.status = In(filterOptions.status);
      } else {
        where.status = filterOptions.status;
      }
    }

    if (filterOptions?.userId) {
      where.userId = filterOptions.userId;
    }

    const entities = await this.ordersRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where: where,
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

    return entities.map((entity) => OrderMapper.toDomain(entity));
  }

  async findById(id: Order['id']): Promise<NullableType<Order>> {
    const entity = await this.ordersRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? OrderMapper.toDomain(entity) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<NullableType<Order>> {
    const entity = await this.ordersRepository.findOne({
      where: { orderNumber },
    });

    return entity ? OrderMapper.toDomain(entity) : null;
  }

  async findByOrderNumberAndUserId(
    orderNumber: string,
    userId: number,
  ): Promise<NullableType<Order>> {
    const entity = await this.ordersRepository.findOne({
      where: { orderNumber, userId },
    });

    return entity ? OrderMapper.toDomain(entity) : null;
  }

  async update(id: Order['id'], payload: Partial<Order>): Promise<Order> {
    const entity = await this.ordersRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('Order not found');
    }

    const updatedEntity = await this.ordersRepository.save(
      this.ordersRepository.create(
        OrderMapper.toPersistence({
          ...OrderMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return OrderMapper.toDomain(updatedEntity);
  }

  async remove(id: Order['id']): Promise<void> {
    await this.ordersRepository.softDelete(id);
  }

  async failExpiredPendingOrders(minutesThreshold: number): Promise<number> {
    const cutoff = new Date(Date.now() - minutesThreshold * 60 * 1000);
    const result = await this.ordersRepository.update(
      { status: 'pending', createdAt: LessThan(cutoff) },
      { status: 'failed' },
    );
    return result.affected ?? 0;
  }
}
