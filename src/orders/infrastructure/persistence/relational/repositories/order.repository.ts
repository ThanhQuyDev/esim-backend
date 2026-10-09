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

/**
 * A topup that went through ends as "completed", an eSIM order as "paid" —
 * so the order list, which opens on "paid", left every successful topup out
 * (#022, test round 4). "Paid" now means paid AND delivered for both kinds.
 * The stored status is untouched: the topup flow tells "paid, not applied
 * yet" from "applied" by it.
 */
export function withSuccessfulTopups(status: string | string[]): string[] {
  const statuses = Array.isArray(status) ? status : [status];
  return statuses.includes('paid') && !statuses.includes('completed')
    ? [...statuses, 'completed']
    : statuses;
}

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
      filterOptions?.orderNumber ||
      filterOptions?.hasInvoice !== undefined ||
      filterOptions?.invoiceStatus ||
      // #017 — kind and the created-date range need SQL of their own.
      filterOptions?.kind ||
      filterOptions?.createdFrom ||
      filterOptions?.createdTo
    ) {
      return this.findManyWithAdvancedFilters(
        filterOptions,
        sortOptions,
        paginationOptions,
      );
    }

    const where: FindOptionsWhere<OrderEntity> = {};

    if (filterOptions?.status) {
      where.status = In(withSuccessfulTopups(filterOptions.status));
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
      qb.andWhere('"order"."status" IN (:...statuses)', {
        statuses: withSuccessfulTopups(filterOptions.status),
      });
    }

    if (filterOptions.userId) {
      qb.andWhere('"order"."userId" = :userId', {
        userId: filterOptions.userId,
      });
    }

    // #017 — kind of order. The three are mutually exclusive: an ordinary eSIM
    // purchase is one that is neither a topup nor commissioned, so the three
    // filters partition the list instead of overlapping on affiliate topups.
    const EARNED_COMMISSION = `"order"."id" IN (
      SELECT "opc"."orderId" FROM "order_partner_commission" "opc"
    )`;
    if (filterOptions.kind === 'topup') {
      qb.andWhere(`"order"."orderType" = 'TOPUP'`);
    } else if (filterOptions.kind === 'affiliate') {
      qb.andWhere(EARNED_COMMISSION);
    } else if (filterOptions.kind === 'esim') {
      qb.andWhere(`COALESCE("order"."orderType", 'BUY_NEW') <> 'TOPUP'`);
      qb.andWhere(`NOT (${EARNED_COMMISSION})`);
    }

    // #017 — created-date range, in VIETNAM days (#022, test round 4).
    // `createdAt` is stored in UTC; comparing it to bare dates in UTC made
    // "up to 25/9" run until 07:00 on 26/9 Vietnam time — so orders placed
    // early on the 26th showed up — and cut the first 7 hours off the 21st.
    // The bounds are now midnight Vietnam time, converted to UTC.
    if (filterOptions.createdFrom) {
      qb.andWhere(
        `"order"."createdAt" >= ((:createdFrom::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC')`,
        { createdFrom: filterOptions.createdFrom },
      );
    }
    if (filterOptions.createdTo) {
      qb.andWhere(
        `"order"."createdAt" < ((:createdTo::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC')`,
        { createdTo: filterOptions.createdTo },
      );
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

    // VAT invoice requests live in their own table (#051): the customer ticks
    // "Xuất hóa đơn" at checkout, or an admin adds one to the order later.
    if (filterOptions.hasInvoice !== undefined) {
      const hasInvoiceSql = `"order"."id" IN (
          SELECT "inv"."orderId" FROM "invoice" "inv"
          WHERE "inv"."orderId" IS NOT NULL
        )`;
      qb.andWhere(
        filterOptions.hasInvoice ? hasInvoiceSql : `NOT ${hasInvoiceSql}`,
      );
    }

    if (filterOptions.invoiceStatus) {
      qb.andWhere(
        `"order"."id" IN (
          SELECT "inv"."orderId" FROM "invoice" "inv"
          WHERE "inv"."status" = :invoiceStatus
        )`,
        { invoiceStatus: filterOptions.invoiceStatus },
      );
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
      // LEFT: a topup has no order lines, and an inner join dropped every
      // topup from the reconciliation file (#023, test round 4). Its row is
      // filled from the order's own topup snapshot below.
      .leftJoin('order_item', 'oi', 'oi."orderId" = "order".id')
      .leftJoin('plan', 'p', 'p.id = oi."planId"')
      .leftJoin('user', 'u', 'u.id = "order"."userId"')
      // Order-level columns for the reconciliation sheet (#018).
      .leftJoin('order_partner_commission', 'opc', 'opc."orderId" = "order".id')
      .leftJoin('partner', 'pt', 'pt.id = opc."partnerId"')
      .leftJoin('invoice', 'inv', 'inv."orderId" = "order".id')
      .where('"order"."deletedAt" IS NULL')
      .select('"order"."id"', 'orderId')
      .addSelect('"order"."orderNumber"', 'orderNumber')
      .addSelect('"order"."status"', 'orderStatus')
      .addSelect('"order"."createdAt"', 'orderCreatedAt')
      .addSelect('"order"."orderType"', 'orderType')
      .addSelect('"order"."paymentMethod"', 'paymentMethod')
      .addSelect('"order"."couponCode"', 'couponCode')
      .addSelect('"order"."referralCode"', 'referralCode')
      .addSelect('"order"."couponDiscountVndAmount"', 'couponDiscountVndAmount')
      .addSelect(
        '"order"."referralDiscountVndAmount"',
        'referralDiscountVndAmount',
      )
      .addSelect('"order"."cashbackAmountVnd"', 'cashbackAmountVnd')
      .addSelect('"order"."walletSpentVndAmount"', 'walletSpentVndAmount')
      .addSelect('"order"."refundedAmountVnd"', 'refundedAmountVnd')
      .addSelect('COALESCE(oi.id, 0)', 'orderItemId')
      .addSelect(
        `(SELECT COUNT(*) FROM "esim" e WHERE e."orderItemId" = oi.id AND e.status = 'refunded')`,
        'refundedEsims',
      )
      // A company partner is settled under its company name; an individual has
      // only a contact name.
      .addSelect(
        `COALESCE(NULLIF(TRIM(pt."companyName"), ''), pt."contactName")`,
        'partnerName',
      )
      .addSelect('opc."commissionVnd"', 'partnerCommissionVnd')
      .addSelect('inv.status', 'invoiceStatus')
      .addSelect('inv."companyName"', 'invoiceCompanyName')
      .addSelect('inv."taxCode"', 'invoiceTaxCode')
      .addSelect('u.email', 'customerEmail')
      .addSelect(
        'COALESCE(p.provider, lower("order"."topupProvider"))',
        'provider',
      )
      .addSelect('COALESCE(p.name, "order"."topupPackageName")', 'planName')
      .addSelect(
        'COALESCE(p."providerPlanId", "order"."topupPackageId")',
        'providerPlanId',
      )
      .addSelect('oi."orderRequestId"', 'providerOrderRef')
      .addSelect('COALESCE(oi.status, "order".status)', 'itemStatus')
      .addSelect('COALESCE(oi.quantity, 1)', 'quantity')
      .addSelect(
        'COALESCE(oi."vndCostPrice", "order"."vndCostPrice")',
        'vndCostPrice',
      )
      .addSelect(
        `COALESCE(oi."vndPrice", "order"."payableVndPrice" + "order"."walletSpentVndAmount")`,
        'vndPrice',
      )
      .addSelect(
        // A topup's eSIM is the one it topped up.
        `COALESCE((SELECT STRING_AGG(e.iccid, ', ') FROM "esim" e WHERE e."orderItemId" = oi.id), "order"."targetIccid")`,
        'iccids',
      )
      .orderBy('"order"."createdAt"', 'DESC')
      .addOrderBy('p.provider', 'ASC');

    this.applyAdvancedFilters(qb, filterOptions ?? {});

    const rows = await qb.getRawMany<{
      orderId: string | number;
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
      orderType: string | null;
      paymentMethod: string | null;
      couponCode: string | null;
      referralCode: string | null;
      couponDiscountVndAmount: string | number | null;
      referralDiscountVndAmount: string | number | null;
      cashbackAmountVnd: string | number | null;
      walletSpentVndAmount: string | number | null;
      refundedAmountVnd: string | number | null;
      orderItemId: string | number;
      refundedEsims: string | number | null;
      partnerName: string | null;
      partnerCommissionVnd: string | number | null;
      invoiceStatus: string | null;
      invoiceCompanyName: string | null;
      invoiceTaxCode: string | null;
    }>();

    return rows.map((row) => ({
      ...row,
      orderId: Number(row.orderId ?? 0),
      quantity: Number(row.quantity ?? 0),
      vndCostPrice: Number(row.vndCostPrice ?? 0),
      vndPrice: Number(row.vndPrice ?? 0),
      couponDiscountVndAmount: Number(row.couponDiscountVndAmount ?? 0),
      referralDiscountVndAmount: Number(row.referralDiscountVndAmount ?? 0),
      cashbackAmountVnd: Number(row.cashbackAmountVnd ?? 0),
      walletSpentVndAmount: Number(row.walletSpentVndAmount ?? 0),
      refundedAmountVnd: Number(row.refundedAmountVnd ?? 0),
      orderItemId: Number(row.orderItemId ?? 0),
      refundedEsims: Number(row.refundedEsims ?? 0),
      partnerCommissionVnd: Number(row.partnerCommissionVnd ?? 0),
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
