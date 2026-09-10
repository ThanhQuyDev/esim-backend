import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository, SelectQueryBuilder } from 'typeorm';
import { OrderEntity } from '../entities/order.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterOrderDto, SortOrderDto } from '../../../../dto/query-order.dto';
import { Order } from '../../../../domain/order';
import {
  OrderRepository,
  ReconciliationExportRow,
} from '../../order.repository';
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
      relations: ['user'],
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
  /**
   * Filters shared by the on-screen order list and the reconciliation export,
   * so the downloaded file always matches what the admin was looking at.
   */
  private applyAdvancedFilters(
    qb: SelectQueryBuilder<OrderEntity>,
    filterOptions: FilterOrderDto,
  ): void {
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
  }

  /**
   * One row per ORDER ITEM for supplier reconciliation (#028).
   *
   * Deliberately not one row per order: an order can carry lines from three
   * different suppliers, and debt is settled with each supplier separately, so
   * an order-level sheet cannot be reconciled at all.
   *
   * Runs through the same filters as the on-screen list, so the file matches
   * what the admin was looking at.
   */
  async findAllForReconciliationExport(
    filterOptions?: FilterOrderDto | null,
  ): Promise<ReconciliationExportRow[]> {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .innerJoin('order_item', 'oi', 'oi."orderId" = "order".id')
      .leftJoin('plan', 'p', 'p.id = oi."planId"')
      .leftJoin('user', 'u', 'u.id = "order"."userId"')
      .where('"order"."deletedAt" IS NULL')
      .select('"order"."orderNumber"', 'orderNumber')
      .addSelect('"order"."status"', 'orderStatus')
      .addSelect('"order"."createdAt"', 'orderCreatedAt')
      .addSelect('u.email', 'customerEmail')
      .addSelect('p.provider', 'provider')
      .addSelect('p.name', 'planName')
      .addSelect('p."providerPlanId"', 'providerPlanId')
      .addSelect('oi."orderRequestId"', 'providerOrderRef')
      .addSelect('oi.status', 'itemStatus')
      .addSelect('oi.quantity', 'quantity')
      .addSelect('oi."vndCostPrice"', 'vndCostPrice')
      .addSelect('oi."vndPrice"', 'vndPrice')
      .addSelect(
        `(SELECT STRING_AGG(e.iccid, ', ') FROM "esim" e WHERE e."orderItemId" = oi.id)`,
        'iccids',
      )
      .orderBy('"order"."createdAt"', 'DESC')
      .addOrderBy('p.provider', 'ASC');

    this.applyAdvancedFilters(qb, filterOptions ?? {});

    const rows = await qb.getRawMany<{
      orderNumber: string;
      orderStatus: string;
      orderCreatedAt: Date;
      customerEmail: string | null;
      provider: string | null;
      planName: string | null;
      providerPlanId: string | null;
      providerOrderRef: string | null;
      itemStatus: string;
      quantity: string | number;
      vndCostPrice: string | number;
      vndPrice: string | number;
      iccids: string | null;
    }>();

    return rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity ?? 0),
      vndCostPrice: Number(row.vndCostPrice ?? 0),
      vndPrice: Number(row.vndPrice ?? 0),
    }));
  }

  private async findManyWithAdvancedFilters(
    filterOptions: FilterOrderDto,
    sortOptions?: SortOrderDto[] | null,
    paginationOptions?: IPaginationOptions,
  ): Promise<[Order[], number]> {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .where('"order"."deletedAt" IS NULL');

    this.applyAdvancedFilters(qb, filterOptions);

    // Sorting
    if (sortOptions?.length) {
      sortOptions.forEach((sort) => {
        qb.addOrderBy(`order.${sort.orderBy}`, sort.order as 'ASC' | 'DESC');
      });
    } else {
      qb.addOrderBy('order.createdAt', 'DESC');
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

  async findByBankTransferCode(
    bankTransferCode: string,
  ): Promise<NullableType<Order>> {
    const entity = await this.ordersRepository.findOne({
      where: { bankTransferCode },
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

  async failExpiredPendingOrders(minutesThreshold: number): Promise<number[]> {
    // The cutoff MUST be computed by Postgres, not by Node. `order.createdAt`
    // is a `timestamp without time zone` filled by the column's `DEFAULT now()`
    // — i.e. the DB's own clock. Passing a JS Date instead makes the driver
    // serialize it in the *app server's* timezone, so on a non-UTC server the
    // comparison is skewed by the whole UTC offset and brand-new orders are
    // failed instantly (observed: a 0.3s-old order matched a 30-minute rule on
    // a UTC+7 host). LOCALTIMESTAMP is the same clock that wrote the row.
    const expiredOrders = await this.ordersRepository
      .createQueryBuilder('order')
      .select(['order.id'])
      .where('order.status = :status', { status: 'pending' })
      // `order.createdAt` (property path) and not `order."createdAt"`: TypeORM
      // only quotes the alias when it rewrites a property path, and `order` is
      // a reserved word — left bare it makes Postgres parse the ORDER keyword.
      .andWhere(
        `order.createdAt < LOCALTIMESTAMP - (:minutesThreshold * INTERVAL '1 minute')`,
        { minutesThreshold },
      )
      .getMany();
    if (expiredOrders.length === 0) return [];
    const ids = expiredOrders.map((o) => o.id);
    await this.ordersRepository.update(ids, { status: 'failed' });
    return ids;
  }

  /**
   * Soft-delete rows of `status` whose timestamp is older than
   * `olderThanDays`. The cutoff is computed by Postgres (LOCALTIMESTAMP), not
   * in Node: the timestamp columns are `timestamp without time zone` written
   * by the DB's own clock, so passing a JS Date makes the driver serialize it
   * in the app server's timezone and skews the window by the whole UTC offset.
   */
  async softDeleteByStatusOlderThan(
    status: string,
    olderThanDays: number,
  ): Promise<number> {
    const result = await this.ordersRepository
      .createQueryBuilder()
      .softDelete()
      .where('status = :status', { status })
      .andWhere(
        `"createdAt" < LOCALTIMESTAMP - (:olderThanDays * INTERVAL '1 day')`,
        { olderThanDays },
      )
      .andWhere('"deletedAt" IS NULL')
      .execute();
    return result.affected ?? 0;
  }
}
