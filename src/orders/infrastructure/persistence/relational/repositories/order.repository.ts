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
  }): Promise<[Order[], number]> {
    // Use QueryBuilder when advanced filters are present
    if (
      filterOptions?.iccid ||
      filterOptions?.planName ||
      filterOptions?.userEmail ||
      filterOptions?.orderNumber
    ) {
      return this.findManyWithAdvancedFilters(
        filterOptions,
        sortOptions,
        paginationOptions,
      );
    }

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

    const [entities, count] = await this.ordersRepository.findAndCount({
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

    return [entities.map((entity) => OrderMapper.toDomain(entity)), count];
  }

  /**
   * Part 12 Feature 2.1 — Advanced filters using QueryBuilder for iccid/planName.
   */
  private async findManyWithAdvancedFilters(
    filterOptions: FilterOrderDto,
    sortOptions?: SortOrderDto[] | null,
    paginationOptions?: IPaginationOptions,
  ): Promise<[Order[], number]> {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .where('"order"."deletedAt" IS NULL');

    if (filterOptions.status) {
      if (Array.isArray(filterOptions.status)) {
        qb.andWhere('"order"."status" IN (:...statuses)', {
          statuses: filterOptions.status,
        });
      } else {
        qb.andWhere('"order"."status" = :status', {
          status: filterOptions.status,
        });
      }
    }

    if (filterOptions.userId) {
      qb.andWhere('"order"."userId" = :userId', {
        userId: filterOptions.userId,
      });
    }

    // Filter by iccid: match on order.targetIccid OR via esim -> order_item
    if (filterOptions.iccid) {
      qb.andWhere(
        `(
          "order"."targetIccid" = :iccid
          OR "order"."id" IN (
            SELECT "oi"."orderId" FROM "order_item" "oi"
            INNER JOIN "esim" "e" ON "e"."orderItemId" = "oi"."id"
            WHERE "e"."iccid" = :iccid
          )
        )`,
        { iccid: filterOptions.iccid },
      );
    }

    // Filter by planName: partial match via order_item -> plan.name
    if (filterOptions.planName) {
      qb.andWhere(
        `"order"."id" IN (
          SELECT "oi"."orderId" FROM "order_item" "oi"
          INNER JOIN "plan" "p" ON "p"."id" = "oi"."planId"
          WHERE "p"."name" ILIKE :planName
        )`,
        { planName: `%${filterOptions.planName}%` },
      );
    }

    // Filter by buyer email: partial match via user table
    if (filterOptions.userEmail) {
      qb.andWhere(
        `"order"."userId" IN (
          SELECT "u"."id" FROM "user" "u"
          WHERE "u"."email" ILIKE :userEmail
        )`,
        { userEmail: `%${filterOptions.userEmail}%` },
      );
    }

    // Filter by orderNumber: partial match (case-insensitive)
    if (filterOptions.orderNumber) {
      qb.andWhere('"order"."orderNumber" ILIKE :orderNumber', {
        orderNumber: `%${filterOptions.orderNumber}%`,
      });
    }

    // Sorting
    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(
          `"order"."${sort.orderBy}"`,
          sort.order as 'ASC' | 'DESC',
        );
      });
    } else {
      qb.addOrderBy('"order"."createdAt"', 'DESC');
    }

    // Pagination
    if (paginationOptions) {
      qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
      qb.take(paginationOptions.limit);
    }

    const [entities, count] = await qb.getManyAndCount();
    return [entities.map((entity) => OrderMapper.toDomain(entity)), count];
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

  async softDeleteByStatusOlderThan(
    status: string,
    olderThan: Date,
  ): Promise<number> {
    const result = await this.ordersRepository
      .createQueryBuilder()
      .softDelete()
      .where('status = :status', { status })
      .andWhere('"createdAt" < :olderThan', { olderThan })
      .andWhere('"deletedAt" IS NULL')
      .execute();
    return result.affected ?? 0;
  }
}
