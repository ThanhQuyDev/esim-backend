import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { OrderEntity } from '../orders/infrastructure/persistence/relational/entities/order.entity';
import { OrderItemEntity } from '../order-items/infrastructure/persistence/relational/entities/order-item.entity';
import { PlanEntity } from '../plans/infrastructure/persistence/relational/entities/plan.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { EsimEntity } from '../esims/infrastructure/persistence/relational/entities/esim.entity';
import {
  ACTIVE_ESIM_STATUSES,
  COMPLETED_ORDER_ITEM_STATUSES,
  COMPLETED_ORDER_STATUSES,
  DEFAULT_TOP_DESTINATIONS_LIMIT,
  FinancialComparisonGroupBy,
  FinancialComparisonQueryDto,
  FinancialComparisonResponseDto,
  FinancialComparisonTotalsDto,
  MAX_OVERVIEW_LIMIT,
  OrdersByDeviceResponseDto,
  OVERVIEW_PROVIDERS,
  OverviewDatePreset,
  OverviewDateRangeQueryDto,
  OverviewProviderFilterQueryDto,
  OverviewResponseDto,
  OverviewSummaryResponseDto,
  ProviderComparisonMetric,
  ProviderComparisonQueryDto,
  ProviderComparisonResponseDto,
  TopDestinationsQueryDto,
  TopDestinationsResponseDto,
} from './dto/overview.dto';

const ORDER_ALIAS = 'purchase_order';
const ORDER_ITEM_ALIAS = 'order_item';
const PLAN_ALIAS = 'plan';

/**
 * Revenue actually earned on an order: what the customer was charged AFTER the
 * coupon ("khuyến mãi") and referral ("giới thiệu") discounts come off, never
 * below zero. Orders written before those columns existed fall back to the
 * stored total.
 *
 * Exported so the formula can be pinned by a test — every revenue and profit
 * figure on the Tổng quan screen is built on it.
 */
export function orderNetRevenueSql(orderAlias: string): string {
  const subtotal = `${orderAlias}."subtotalVndPrice"`;
  const discounts = `${orderAlias}."couponDiscountVndAmount" + ${orderAlias}."referralDiscountVndAmount"`;

  return `CASE WHEN ${subtotal} > 0 THEN GREATEST(${subtotal} - ${discounts}, 0) ELSE ${orderAlias}."vndPrice" END`;
}

/**
 * One order line's revenue: its price less its part of the order's discounts.
 *
 * The discount is spread over the lines that COUNT — the delivered ones — not
 * over the whole order. Spread over the whole order, it left a share of the
 * discount on a refunded or undelivered line that is then dropped, so a
 * 1.616.000₫ order with a 156.000₫ line refunded read 1.461.907₫ instead of the
 * 1.460.000₫ actually kept (v3 #026). Spread over the counted lines, they add
 * up to the counted subtotal minus the discount: always a whole figure, and
 * exactly {@link orderNetRevenueSql} when every line counts.
 */
export function itemNetRevenueSql(
  orderAlias: string,
  itemAlias: string,
): string {
  const subtotal = `${orderAlias}."subtotalVndPrice"`;
  const discounts = `(${orderAlias}."couponDiscountVndAmount" + ${orderAlias}."referralDiscountVndAmount")`;
  const statuses = COMPLETED_ORDER_ITEM_STATUSES.map((s) => `'${s}'`).join(
    ', ',
  );
  const countedSubtotal = `(SELECT COALESCE(SUM(counted."vndPrice"), 0) FROM "order_item" counted WHERE counted."orderId" = ${orderAlias}.id AND counted.status IN (${statuses}))`;

  return `CASE WHEN ${subtotal} > 0 AND ${countedSubtotal} > 0 THEN GREATEST(${itemAlias}."vndPrice" - ${discounts} * ${itemAlias}."vndPrice" / ${countedSubtotal}, 0) ELSE ${itemAlias}."vndPrice" END`;
}
/** Commission esim.vn still owes on an order (vande #016). */
export const OWED_COMMISSION_STATUSES = ['pending', 'credited'] as const;

const OWED_COMMISSION_SQL = OWED_COMMISSION_STATUSES.map((s) => `'${s}'`).join(
  ', ',
);

/**
 * The part of an order's partner commission that one delivered line carries
 * (vande #016).
 *
 * Profit on Tổng quan was revenue − cost, as if esim.vn kept 100% of every
 * sale; on an order a partner brought in, the partner's commission is ours to
 * pay. Only commission still owed counts — `pending` and `credited` — whose
 * `commissionVnd` is already reduced for partial refunds (#018); `reversed`
 * and `rejected` cost nothing. It is spread over the delivered lines like the
 * discount in {@link itemNetRevenueSql}, so the lines add up to the order's
 * whole commission.
 */
export function itemPartnerCommissionSql(
  orderAlias: string,
  itemAlias: string,
): string {
  const statuses = COMPLETED_ORDER_ITEM_STATUSES.map((s) => `'${s}'`).join(
    ', ',
  );
  const commission = `(SELECT COALESCE(SUM(c."commissionVnd"), 0) FROM "order_partner_commission" c WHERE c."orderId" = ${orderAlias}.id AND c.status IN (${OWED_COMMISSION_SQL}))`;
  const countedSubtotal = `(SELECT COALESCE(SUM(counted."vndPrice"), 0) FROM "order_item" counted WHERE counted."orderId" = ${orderAlias}.id AND counted.status IN (${statuses}))`;
  const countedLines = `(SELECT COUNT(*) FROM "order_item" counted WHERE counted."orderId" = ${orderAlias}.id AND counted.status IN (${statuses}))`;

  return `CASE WHEN ${countedSubtotal} > 0 THEN ${commission} * ${itemAlias}."vndPrice" / ${countedSubtotal} ELSE ${commission} / GREATEST(${countedLines}, 1) END`;
}

/**
 * Where an order came from, for "Lợi nhuận theo loại đơn" (vande #016): a
 * partner buying from their wallet at the partner price, a customer a partner
 * referred (we owe commission), or a customer buying direct.
 */
export function orderSourceSql(orderAlias: string): string {
  return `CASE WHEN ${orderAlias}."paymentMethod" = 'partner_wallet' THEN 'partner_purchase' WHEN EXISTS (SELECT 1 FROM "order_partner_commission" c WHERE c."orderId" = ${orderAlias}.id AND c.status IN (${OWED_COMMISSION_SQL})) THEN 'partner_referral' ELSE 'direct' END`;
}

/** Fixed order of the order-source groups, every one listed even at zero. */
export const ORDER_SOURCES = [
  'direct',
  'partner_referral',
  'partner_purchase',
] as const;

const UNKNOWN_GROUP = 'Unknown';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Convert a Vietnam calendar-day offset into exact UTC query boundaries. */
export function vietnamDayRangeUtc(
  now: Date,
  offsetDays = 0,
): {
  from: Date;
  to: Date;
} {
  const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
  const year = vnNow.getUTCFullYear();
  const month = vnNow.getUTCMonth();
  const day = vnNow.getUTCDate() + offsetDays;

  return {
    from: new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - VN_OFFSET_MS),
    to: new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - VN_OFFSET_MS),
  };
}

/**
 * The CMS date-range picker sends calendar days (`yyyy-MM-dd`) with no time or
 * zone. `new Date('2026-09-01')` parses those as UTC midnight, which is 07:00
 * in Vietnam — so the first seven hours of the day were dropped from every
 * custom-range report. Expand such values into the exact Vietnam-day
 * boundaries instead; timestamps that already carry a time/zone pass through.
 */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function vietnamBoundaryFromInput(
  value: string,
  edge: 'start' | 'end',
): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return new Date(value);
  }

  const [year, month, day] = value.split('-').map(Number);
  const utcMs =
    edge === 'start'
      ? Date.UTC(year, month - 1, day, 0, 0, 0, 0)
      : Date.UTC(year, month - 1, day, 23, 59, 59, 999);

  return new Date(utcMs - VN_OFFSET_MS);
}

type RawValue = string | number | null | undefined;
type PeriodGroupBy = 'day' | 'week' | 'month' | 'year';
type OrderItemQuery = SelectQueryBuilder<OrderItemEntity>;

interface ProviderAggregate {
  provider: string;
  orders: number;
  revenue: number;
  plansSold: number;
  completedItems: number;
  totalItems: number;
}

interface ProviderSeriesRow {
  date: string;
  [providerName: string]: string | number;
}

interface FinancialValue {
  costPrice: number;
  totalRevenue: number;
  /** Partner commission still owed on these sales (vande #016). */
  partnerCommission: number;
  /** Revenue − cost − partner commission. */
  profit: number;
  profitMarginPercent: number;
  /** Plans delivered (sum of item quantity) behind these figures. */
  plansSold: number;
}

interface FinancialGroupValue extends FinancialValue {
  group: string;
  /** Orders behind the figures; groupBy=orderSource only. */
  orders?: number;
}

interface FinancialSeriesValue extends FinancialValue {
  date: string;
}

@Injectable()
export class OverviewService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly ordersRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemsRepository: Repository<OrderItemEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(EsimEntity)
    private readonly esimsRepository: Repository<EsimEntity>,
  ) {}

  async getOverview(
    query: OverviewProviderFilterQueryDto,
  ): Promise<OverviewResponseDto> {
    const [summary, providerComparison, topDestinations, financialComparison] =
      await Promise.all([
        this.getSummary(query),
        this.getProviderComparison({
          from: query.from,
          to: query.to,
          groupBy: 'provider',
        }),
        this.getTopDestinations(query),
        this.getFinancialComparison({
          from: query.from,
          to: query.to,
          provider: query.provider,
          groupBy: 'day',
        }),
      ]);

    return {
      summary,
      providerComparison,
      topDestinations,
      financialComparison,
    };
  }

  async getSummary(
    query: OverviewProviderFilterQueryDto,
  ): Promise<OverviewSummaryResponseDto> {
    const ordersQb = this.ordersRepository.createQueryBuilder(ORDER_ALIAS);
    this.applyDateRange(ordersQb, ORDER_ALIAS, query);

    if (query.provider) {
      ordersQb
        .innerJoin(
          OrderItemEntity,
          ORDER_ITEM_ALIAS,
          `${ORDER_ITEM_ALIAS}."orderId" = ${ORDER_ALIAS}.id`,
        )
        .innerJoin(
          PlanEntity,
          PLAN_ALIAS,
          `${PLAN_ALIAS}.id = ${ORDER_ITEM_ALIAS}."planId"`,
        )
        .andWhere(`${PLAN_ALIAS}.provider = :summaryProvider`, {
          summaryProvider: query.provider,
        });
    }

    const ordersRaw = await ordersQb
      .select(
        `COUNT(DISTINCT CASE WHEN ${ORDER_ALIAS}.status IN (:...completedOrderStatuses) THEN ${ORDER_ALIAS}.id END)`,
        'totalOrders',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN ${ORDER_ALIAS}.status = :failedOrderStatus THEN ${ORDER_ALIAS}.id END)`,
        'failedOrders',
      )
      .setParameters({
        completedOrderStatuses: [...COMPLETED_ORDER_STATUSES],
        failedOrderStatus: 'failed',
      })
      .getRawOne<{
        totalOrders?: RawValue;
        failedOrders?: RawValue;
      }>();

    const [totalRevenue, totalPlansSold, totalUsers, activePlans] =
      await Promise.all([
        this.getSummaryTotalRevenue(query),
        this.getSummaryTotalPlansSold(query),
        this.getSummaryTotalUsers(query),
        this.getSummaryActivePlans(query),
      ]);

    return {
      totalOrders: this.toNumber(ordersRaw?.totalOrders),
      totalRevenue,
      totalPlansSold,
      totalUsers,
      activePlans,
      failedOrders: this.toNumber(ordersRaw?.failedOrders),
    };
  }

  async getProviderComparison(
    query: ProviderComparisonQueryDto,
  ): Promise<ProviderComparisonResponseDto> {
    const groupBy = query.groupBy ?? 'provider';

    if (groupBy === 'provider') {
      const [aggregates, providers] = await Promise.all([
        this.getProviderAggregates(query),
        this.overviewProviders(),
      ]);
      return {
        data: providers.map((provider) => {
          const aggregate =
            aggregates.get(provider) ??
            this.createEmptyProviderAggregate(provider);

          return {
            provider,
            orders: aggregate.orders,
            revenue: aggregate.revenue,
            plansSold: aggregate.plansSold,
            successRate: this.calculateSuccessRate(
              aggregate.completedItems,
              aggregate.totalItems,
            ),
          };
        }),
      };
    }

    const metric = query.metric ?? 'orders';
    const rawRows = await this.createProviderBaseQuery(query)
      .select(this.getDateBucketExpression(groupBy), 'bucket')
      .addSelect(`${PLAN_ALIAS}.provider`, 'provider')
      .addSelect(this.completedOrdersCountExpression(), 'orders')
      .addSelect(this.completedItemsSumExpression('vndPrice'), 'revenue')
      .addSelect(this.completedItemsSumExpression('quantity'), 'plansSold')
      .addSelect(this.completedItemsCountExpression(), 'completedItems')
      .addSelect(`COUNT(${ORDER_ITEM_ALIAS}.id)`, 'totalItems')
      .groupBy('bucket')
      .addGroupBy(`${PLAN_ALIAS}.provider`)
      .orderBy('bucket', 'ASC')
      .getRawMany<{
        bucket: RawValue;
        provider: string;
        orders: RawValue;
        revenue: RawValue;
        plansSold: RawValue;
        completedItems: RawValue;
        totalItems: RawValue;
      }>();

    const providers = await this.overviewProviders();
    const rowsByBucket = new Map<string, ProviderSeriesRow>();
    for (const row of rawRows) {
      const date = this.formatBucket(row.bucket);
      const item =
        rowsByBucket.get(date) ?? this.createProviderSeriesRow(date, providers);
      item[row.provider] = this.getMetricValue(metric, {
        provider: row.provider,
        orders: this.toNumber(row.orders),
        revenue: this.toNumber(row.revenue),
        plansSold: this.toNumber(row.plansSold),
        completedItems: this.toNumber(row.completedItems),
        totalItems: this.toNumber(row.totalItems),
      });
      rowsByBucket.set(date, item);
    }

    return {
      providers,
      series: [...rowsByBucket.values()],
    };
  }

  /**
   * Successful orders by the device they were placed from (doitac-1410 #083):
   * an order counts once, however many lines it has, when one of its lines
   * completed. Same date / supplier filter as the other blocks.
   */
  async getOrdersByDevice(
    query: OverviewProviderFilterQueryDto,
  ): Promise<OrdersByDeviceResponseDto> {
    const deviceExpression = `COALESCE(${ORDER_ALIAS}."deviceType", 'unknown')`;
    const rows = await this.createCompletedItemsQuery(ORDER_ITEM_ALIAS, query)
      .select(deviceExpression, 'deviceType')
      .addSelect(`COUNT(DISTINCT ${ORDER_ALIAS}.id)`, 'orders')
      .groupBy(deviceExpression)
      .getRawMany<{ deviceType?: RawValue; orders?: RawValue }>();

    const order = ['desktop', 'mobile', 'tablet', 'unknown'] as const;
    const counts = new Map<string, number>(
      rows.map((row) => [String(row.deviceType), this.toNumber(row.orders)]),
    );
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    return {
      total,
      data: order
        .filter((type) => (counts.get(type) ?? 0) > 0)
        .map((type) => {
          const orders = counts.get(type) ?? 0;
          return {
            deviceType: type,
            orders,
            percent: total ? Math.round((orders / total) * 1000) / 10 : 0,
          };
        }),
    };
  }

  async getTopDestinations(
    query: TopDestinationsQueryDto,
  ): Promise<TopDestinationsResponseDto> {
    const limit = this.getLimit(query.limit);
    const destinationGroupExpression = this.getDestinationGroupExpression();
    const destinationNameExpression = this.getDestinationNameExpression();

    const rawRows = await this.createCompletedItemsQuery(
      ORDER_ITEM_ALIAS,
      query,
    )
      .leftJoin(`${PLAN_ALIAS}.destination`, 'destination')
      .leftJoin(`${PLAN_ALIAS}.region`, 'region')
      .select(destinationGroupExpression, 'groupKey')
      .addSelect('destination.id', 'destinationId')
      .addSelect(destinationNameExpression, 'destinationName')
      .addSelect(
        `COALESCE(SUM(${ORDER_ITEM_ALIAS}.quantity), 0)`,
        'plansPurchased',
      )
      .addSelect(
        `COALESCE(SUM(${this.itemNetRevenueExpression()}), 0)`,
        'revenue',
      )
      .groupBy(destinationGroupExpression)
      .addGroupBy('destination.id')
      .addGroupBy(destinationNameExpression)
      .orderBy('"plansPurchased"', 'DESC')
      .limit(limit)
      .getRawMany<{
        destinationId?: RawValue;
        destinationName?: RawValue;
        plansPurchased?: RawValue;
        revenue?: RawValue;
      }>();

    return {
      data: rawRows.map((row) => ({
        destinationId:
          row.destinationId === null || row.destinationId === undefined
            ? undefined
            : this.toNumber(row.destinationId),
        destinationName: String(row.destinationName ?? UNKNOWN_GROUP),
        plansPurchased: this.toNumber(row.plansPurchased),
        revenue: this.toNumber(row.revenue),
      })),
    };
  }

  async getFinancialComparison(
    query: FinancialComparisonQueryDto,
  ): Promise<FinancialComparisonResponseDto> {
    const groupBy = query.groupBy ?? 'day';

    if (this.isPeriodGroupBy(groupBy)) {
      const series = await this.getFinancialSeries(query, groupBy);
      return {
        series,
        totals: this.calculateFinancialTotals(series),
      };
    }

    const data = await this.getFinancialGroups(query, groupBy);
    return {
      data,
      totals: this.calculateFinancialTotals(data),
    };
  }

  /**
   * Summed per delivered line, never per order. A partial refund (#014) marks
   * only the refunded lines `refunded` and leaves the order `paid`, so the
   * order-level total kept the refunded money in the "Tổng doanh thu" card
   * (#009). Summing completed lines drops it, and makes the card match the
   * revenue in the financial chart, which was always line-based.
   */
  private async getSummaryTotalRevenue(
    query: OverviewProviderFilterQueryDto,
  ): Promise<number> {
    const raw = await this.createCompletedItemsQuery(ORDER_ITEM_ALIAS, query)
      .select(
        `COALESCE(SUM(${this.itemNetRevenueExpression()}), 0)`,
        'totalRevenue',
      )
      .getRawOne<{ totalRevenue?: RawValue }>();

    return this.toNumber(raw?.totalRevenue);
  }

  private async getSummaryTotalPlansSold(
    query: OverviewProviderFilterQueryDto,
  ): Promise<number> {
    const raw = await this.createCompletedItemsQuery(ORDER_ITEM_ALIAS, query)
      .select(
        `COALESCE(SUM(${ORDER_ITEM_ALIAS}.quantity), 0)`,
        'totalPlansSold',
      )
      .getRawOne<{ totalPlansSold?: RawValue }>();

    return this.toNumber(raw?.totalPlansSold);
  }

  private async getSummaryTotalUsers(
    query: OverviewDateRangeQueryDto,
  ): Promise<number> {
    const usersQb = this.usersRepository.createQueryBuilder('user');
    this.applyDateRange(usersQb, 'user', query);
    return usersQb.getCount();
  }

  private async getSummaryActivePlans(
    query: OverviewProviderFilterQueryDto,
  ): Promise<number> {
    const activePlansQb = this.esimsRepository
      .createQueryBuilder('esim')
      .innerJoin(
        OrderItemEntity,
        ORDER_ITEM_ALIAS,
        `${ORDER_ITEM_ALIAS}.id = esim."orderItemId"`,
      )
      .innerJoin(
        OrderEntity,
        ORDER_ALIAS,
        `${ORDER_ALIAS}.id = ${ORDER_ITEM_ALIAS}."orderId"`,
      )
      .innerJoin(
        PlanEntity,
        PLAN_ALIAS,
        `${PLAN_ALIAS}.id = ${ORDER_ITEM_ALIAS}."planId"`,
      )
      .where(`${ORDER_ALIAS}.status IN (:...completedOrderStatuses)`, {
        completedOrderStatuses: [...COMPLETED_ORDER_STATUSES],
      })
      .andWhere(
        `${ORDER_ITEM_ALIAS}.status IN (:...completedOrderItemStatuses)`,
        {
          completedOrderItemStatuses: [...COMPLETED_ORDER_ITEM_STATUSES],
        },
      )
      .andWhere('esim.status IN (:...activeEsimStatuses)', {
        activeEsimStatuses: [...ACTIVE_ESIM_STATUSES],
      });

    this.applyDateRange(activePlansQb, ORDER_ALIAS, query);

    if (query.provider) {
      activePlansQb.andWhere(`${PLAN_ALIAS}.provider = :activePlansProvider`, {
        activePlansProvider: query.provider,
      });
    }

    return activePlansQb.getCount();
  }

  private async getProviderAggregates(
    query: OverviewDateRangeQueryDto,
  ): Promise<Map<string, ProviderAggregate>> {
    const rawRows = await this.createProviderBaseQuery(query)
      .select(`${PLAN_ALIAS}.provider`, 'provider')
      .addSelect(this.completedOrdersCountExpression(), 'orders')
      .addSelect(this.completedItemsSumExpression('vndPrice'), 'revenue')
      .addSelect(this.completedItemsSumExpression('quantity'), 'plansSold')
      .addSelect(this.completedItemsCountExpression(), 'completedItems')
      .addSelect(`COUNT(${ORDER_ITEM_ALIAS}.id)`, 'totalItems')
      .groupBy(`${PLAN_ALIAS}.provider`)
      .getRawMany<{
        provider: string;
        orders: RawValue;
        revenue: RawValue;
        plansSold: RawValue;
        completedItems: RawValue;
        totalItems: RawValue;
      }>();

    return new Map<string, ProviderAggregate>(
      rawRows.map((row) => [
        row.provider,
        {
          provider: row.provider,
          orders: this.toNumber(row.orders),
          revenue: this.toNumber(row.revenue),
          plansSold: this.toNumber(row.plansSold),
          completedItems: this.toNumber(row.completedItems),
          totalItems: this.toNumber(row.totalItems),
        },
      ]),
    );
  }

  private async getFinancialSeries(
    query: FinancialComparisonQueryDto,
    groupBy: PeriodGroupBy,
  ): Promise<FinancialSeriesValue[]> {
    const rawRows = await this.createCompletedItemsQuery(
      ORDER_ITEM_ALIAS,
      query,
    )
      .select(this.getDateBucketExpression(groupBy), 'bucket')
      .addSelect(
        `COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndCostPrice"), 0)`,
        'costPrice',
      )
      .addSelect(
        `COALESCE(SUM(${this.itemNetRevenueExpression()}), 0)`,
        'totalRevenue',
      )
      .addSelect(this.partnerCommissionSumExpression(), 'partnerCommission')
      .addSelect(`COALESCE(SUM(${ORDER_ITEM_ALIAS}.quantity), 0)`, 'plansSold')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{
        bucket: RawValue;
        costPrice: RawValue;
        totalRevenue: RawValue;
        partnerCommission: RawValue;
        plansSold: RawValue;
      }>();

    return rawRows.map((row) => ({
      date: this.formatBucket(row.bucket),
      ...this.createFinancialValue(
        row.costPrice,
        row.totalRevenue,
        row.plansSold,
        row.partnerCommission,
      ),
    }));
  }

  private async getFinancialGroups(
    query: FinancialComparisonQueryDto,
    groupBy: Exclude<FinancialComparisonGroupBy, PeriodGroupBy>,
  ): Promise<FinancialGroupValue[]> {
    const qb = this.createCompletedItemsQuery(ORDER_ITEM_ALIAS, query);

    if (groupBy === 'orderSource') {
      const sourceExpression = orderSourceSql(ORDER_ALIAS);
      const rows = await qb
        .select(sourceExpression, 'group')
        .addSelect(
          `COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndCostPrice"), 0)`,
          'costPrice',
        )
        .addSelect(
          `COALESCE(SUM(${this.itemNetRevenueExpression()}), 0)`,
          'totalRevenue',
        )
        .addSelect(this.partnerCommissionSumExpression(), 'partnerCommission')
        .addSelect(
          `COALESCE(SUM(${ORDER_ITEM_ALIAS}.quantity), 0)`,
          'plansSold',
        )
        .addSelect(`COUNT(DISTINCT ${ORDER_ALIAS}.id)`, 'orders')
        .groupBy(sourceExpression)
        .getRawMany<{
          group: string;
          costPrice: RawValue;
          totalRevenue: RawValue;
          partnerCommission: RawValue;
          plansSold: RawValue;
          orders: RawValue;
        }>();

      const bySource = new Map(rows.map((row) => [row.group, row]));
      return ORDER_SOURCES.map((source) => {
        const row = bySource.get(source);
        return {
          group: source,
          orders: this.toNumber(row?.orders),
          ...this.createFinancialValue(
            row?.costPrice,
            row?.totalRevenue,
            row?.plansSold,
            row?.partnerCommission,
          ),
        };
      });
    }

    if (groupBy === 'provider') {
      const rows = await qb
        .select(`${PLAN_ALIAS}.provider`, 'group')
        .addSelect(
          `COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndCostPrice"), 0)`,
          'costPrice',
        )
        .addSelect(
          `COALESCE(SUM(${this.itemNetRevenueExpression()}), 0)`,
          'totalRevenue',
        )
        .addSelect(this.partnerCommissionSumExpression(), 'partnerCommission')
        .addSelect(
          `COALESCE(SUM(${ORDER_ITEM_ALIAS}.quantity), 0)`,
          'plansSold',
        )
        .groupBy(`${PLAN_ALIAS}.provider`)
        .orderBy('"totalRevenue"', 'DESC')
        .getRawMany<{
          group: string;
          costPrice: RawValue;
          totalRevenue: RawValue;
          partnerCommission: RawValue;
          plansSold: RawValue;
        }>();

      const byProvider = new Map<string, FinancialGroupValue>(
        rows.map((row) => [
          row.group,
          {
            group: row.group,
            ...this.createFinancialValue(
              row.costPrice,
              row.totalRevenue,
              row.plansSold,
              row.partnerCommission,
            ),
          },
        ]),
      );

      const providers = await this.overviewProviders();
      return providers.map(
        (provider) =>
          byProvider.get(provider) ?? {
            group: provider,
            ...this.createFinancialValue(0, 0),
          },
      );
    }

    const limit = this.getLimit(query.limit);
    const destinationGroupExpression = this.getDestinationGroupExpression();
    const destinationNameExpression = this.getDestinationNameExpression();

    const rows = await qb
      .leftJoin(`${PLAN_ALIAS}.destination`, 'destination')
      .leftJoin(`${PLAN_ALIAS}.region`, 'region')
      .select(destinationGroupExpression, 'groupKey')
      .addSelect(destinationNameExpression, 'group')
      .addSelect(
        `COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndCostPrice"), 0)`,
        'costPrice',
      )
      .addSelect(
        `COALESCE(SUM(${this.itemNetRevenueExpression()}), 0)`,
        'totalRevenue',
      )
      .addSelect(this.partnerCommissionSumExpression(), 'partnerCommission')
      .addSelect(`COALESCE(SUM(${ORDER_ITEM_ALIAS}.quantity), 0)`, 'plansSold')
      .groupBy(destinationGroupExpression)
      .addGroupBy(destinationNameExpression)
      .orderBy('"totalRevenue"', 'DESC')
      .limit(limit)
      .getRawMany<{
        group: string;
        costPrice: RawValue;
        totalRevenue: RawValue;
        partnerCommission: RawValue;
        plansSold: RawValue;
      }>();

    return rows.map((row) => ({
      group: row.group,
      ...this.createFinancialValue(
        row.costPrice,
        row.totalRevenue,
        row.plansSold,
        row.partnerCommission,
      ),
    }));
  }

  private createProviderBaseQuery(
    query: OverviewDateRangeQueryDto,
  ): OrderItemQuery {
    const qb = this.orderItemsRepository
      .createQueryBuilder(ORDER_ITEM_ALIAS)
      .innerJoin(`${ORDER_ITEM_ALIAS}.order`, ORDER_ALIAS)
      .innerJoin(`${ORDER_ITEM_ALIAS}.plan`, PLAN_ALIAS)
      // Every supplier, not a fixed list: an order on a supplier added later —
      // e.g. a domestic itel eSIM ordered on a customer's behalf — dropped out
      // of the overview entirely (#063, test round 4).
      .where(`${PLAN_ALIAS}.provider IS NOT NULL`)
      .setParameters({
        completedOrderStatuses: [...COMPLETED_ORDER_STATUSES],
        completedOrderItemStatuses: [...COMPLETED_ORDER_ITEM_STATUSES],
      });

    this.applyDateRange(qb, ORDER_ALIAS, query);
    return qb;
  }

  private createCompletedItemsQuery(
    alias: string,
    query: OverviewProviderFilterQueryDto,
  ): OrderItemQuery {
    const qb = this.orderItemsRepository
      .createQueryBuilder(alias)
      .innerJoin(`${alias}.order`, ORDER_ALIAS)
      .innerJoin(`${alias}.plan`, PLAN_ALIAS)
      .where(`${ORDER_ALIAS}.status IN (:...completedOrderStatuses)`, {
        completedOrderStatuses: [...COMPLETED_ORDER_STATUSES],
      })
      .andWhere(`${alias}.status IN (:...completedOrderItemStatuses)`, {
        completedOrderItemStatuses: [...COMPLETED_ORDER_ITEM_STATUSES],
      });

    this.applyDateRange(qb, ORDER_ALIAS, query);

    if (query.provider) {
      qb.andWhere(`${PLAN_ALIAS}.provider = :provider`, {
        provider: query.provider,
      });
    }

    return qb;
  }

  private applyDateRange<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    query: OverviewDateRangeQueryDto,
  ): void {
    const resolved = this.resolveDateRange(query);

    if (resolved.from) {
      qb.andWhere(`"${alias}"."createdAt" >= :from`, {
        from: vietnamBoundaryFromInput(resolved.from, 'start'),
      });
    }

    if (resolved.to) {
      qb.andWhere(`"${alias}"."createdAt" <= :to`, {
        to: vietnamBoundaryFromInput(resolved.to, 'end'),
      });
    }
  }

  private resolveDateRange(query: OverviewDateRangeQueryDto): {
    from?: string;
    to?: string;
  } {
    if (query.preset) {
      return this.presetToDateRange(query.preset);
    }

    return { from: query.from, to: query.to };
  }

  private presetToDateRange(preset: OverviewDatePreset): {
    from: string;
    to: string;
  } {
    const now = new Date();
    const range = (offsetDays: number) => vietnamDayRangeUtc(now, offsetDays);

    switch (preset) {
      case 'today':
        return {
          from: range(0).from.toISOString(),
          to: range(0).to.toISOString(),
        };
      case 'yesterday':
        return {
          from: range(-1).from.toISOString(),
          to: range(-1).to.toISOString(),
        };
      case 'last7days':
        return {
          from: range(-6).from.toISOString(),
          to: range(0).to.toISOString(),
        };
      case 'last30days':
        return {
          from: range(-29).from.toISOString(),
          to: range(0).to.toISOString(),
        };
    }
  }

  private completedOrdersCountExpression(): string {
    return `COUNT(DISTINCT CASE WHEN ${ORDER_ALIAS}.status IN (:...completedOrderStatuses) THEN ${ORDER_ALIAS}.id END)`;
  }

  private completedItemsCountExpression(): string {
    return `COUNT(CASE WHEN ${ORDER_ALIAS}.status IN (:...completedOrderStatuses) AND ${ORDER_ITEM_ALIAS}.status IN (:...completedOrderItemStatuses) THEN 1 END)`;
  }

  private completedItemsSumExpression(column: 'quantity' | 'vndPrice'): string {
    const columnExpression =
      column === 'quantity'
        ? `${ORDER_ITEM_ALIAS}.quantity`
        : this.itemNetRevenueExpression();

    return `COALESCE(SUM(CASE WHEN ${ORDER_ALIAS}.status IN (:...completedOrderStatuses) AND ${ORDER_ITEM_ALIAS}.status IN (:...completedOrderItemStatuses) THEN ${columnExpression} ELSE 0 END), 0)`;
  }

  private itemNetRevenueExpression(): string {
    return itemNetRevenueSql(ORDER_ALIAS, ORDER_ITEM_ALIAS);
  }

  private partnerCommissionSumExpression(): string {
    return `COALESCE(SUM(${itemPartnerCommissionSql(ORDER_ALIAS, ORDER_ITEM_ALIAS)}), 0)`;
  }

  private getDateBucketExpression(groupBy: PeriodGroupBy): string {
    // Shift the naive UTC timestamp into Vietnam wall-clock time before grouping.
    const vnCreatedAt = `(${ORDER_ALIAS}."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE '${VN_TIMEZONE}')`;

    if (groupBy === 'year') {
      return `TO_CHAR(DATE_TRUNC('year', ${vnCreatedAt}), 'YYYY')`;
    }

    if (groupBy === 'week') {
      return `TO_CHAR(DATE_TRUNC('week', ${vnCreatedAt}), 'IYYY-IW')`;
    }

    if (groupBy === 'month') {
      return `TO_CHAR(DATE_TRUNC('month', ${vnCreatedAt}), 'YYYY-MM')`;
    }

    return `TO_CHAR(DATE_TRUNC('day', ${vnCreatedAt}), 'YYYY-MM-DD')`;
  }

  private getDestinationGroupExpression(): string {
    return `COALESCE(CAST(destination.id AS text), CONCAT('region:', region.id), 'unknown')`;
  }

  private getDestinationNameExpression(): string {
    return `COALESCE(destination.name, region.name, ${PLAN_ALIAS}."countryCode", '${UNKNOWN_GROUP}')`;
  }

  private formatBucket(value: RawValue): string {
    return String(value ?? '');
  }

  /**
   * The suppliers the overview reports on: the known ones (always shown, even
   * with no sales) plus any other supplier that has plans — domestic stock such
   * as itel, or one added later (#063, test round 4).
   */
  private async overviewProviders(): Promise<string[]> {
    try {
      const rows: { provider: string }[] =
        await this.orderItemsRepository.manager.query(
          `SELECT DISTINCT provider FROM "plan"
            WHERE provider IS NOT NULL AND provider <> '' AND "deletedAt" IS NULL`,
        );
      const known = OVERVIEW_PROVIDERS as readonly string[];
      const extra = rows
        .map((row) => row.provider)
        .filter((provider) => !known.includes(provider))
        .sort();
      return [...known, ...extra];
    } catch {
      // The known suppliers are still a useful answer if the lookup fails.
      return [...OVERVIEW_PROVIDERS];
    }
  }

  private createProviderSeriesRow(
    date: string,
    providers: readonly string[],
  ): ProviderSeriesRow {
    return providers.reduce<ProviderSeriesRow>(
      (row, provider) => {
        row[provider] = 0;
        return row;
      },
      { date },
    );
  }

  private createEmptyProviderAggregate(provider: string): ProviderAggregate {
    return {
      provider,
      orders: 0,
      revenue: 0,
      plansSold: 0,
      completedItems: 0,
      totalItems: 0,
    };
  }

  private getMetricValue(
    metric: ProviderComparisonMetric,
    aggregate: ProviderAggregate,
  ): number {
    if (metric === 'revenue') {
      return aggregate.revenue;
    }

    if (metric === 'plansSold') {
      return aggregate.plansSold;
    }

    if (metric === 'successRate') {
      return this.calculateSuccessRate(
        aggregate.completedItems,
        aggregate.totalItems,
      );
    }

    return aggregate.orders;
  }

  private calculateSuccessRate(
    completedItems: number,
    totalItems: number,
  ): number {
    if (totalItems <= 0) {
      return 0;
    }

    return this.roundMoney((completedItems / totalItems) * 100);
  }

  private calculateFinancialTotals(
    rows: Array<
      Pick<
        FinancialValue,
        'costPrice' | 'totalRevenue' | 'plansSold' | 'partnerCommission'
      >
    >,
  ): FinancialComparisonTotalsDto {
    const costPrice = rows.reduce((sum, row) => sum + row.costPrice, 0);
    const totalRevenue = rows.reduce((sum, row) => sum + row.totalRevenue, 0);
    const plansSold = rows.reduce((sum, row) => sum + row.plansSold, 0);
    const partnerCommission = rows.reduce(
      (sum, row) => sum + row.partnerCommission,
      0,
    );
    return this.createFinancialValue(
      costPrice,
      totalRevenue,
      plansSold,
      partnerCommission,
    );
  }

  /**
   * Profit is what esim.vn keeps: revenue less the supplier cost AND the
   * partner commission owed on referred orders (vande #016).
   */
  private createFinancialValue(
    costPriceValue: RawValue,
    totalRevenueValue: RawValue,
    plansSoldValue: RawValue = 0,
    partnerCommissionValue: RawValue = 0,
  ): FinancialComparisonTotalsDto {
    const costPrice = this.toNumber(costPriceValue);
    const totalRevenue = this.toNumber(totalRevenueValue);
    const partnerCommission = this.toNumber(partnerCommissionValue);
    const profit = totalRevenue - costPrice - partnerCommission;

    return {
      costPrice: this.roundMoney(costPrice),
      totalRevenue: this.roundMoney(totalRevenue),
      partnerCommission: this.roundMoney(partnerCommission),
      profit: this.roundMoney(profit),
      profitMarginPercent:
        totalRevenue > 0 ? this.roundMoney((profit / totalRevenue) * 100) : 0,
      plansSold: this.toNumber(plansSoldValue),
    };
  }

  private getLimit(limit?: number): number {
    return Math.min(
      limit ?? DEFAULT_TOP_DESTINATIONS_LIMIT,
      MAX_OVERVIEW_LIMIT,
    );
  }

  private isPeriodGroupBy(
    groupBy: FinancialComparisonGroupBy,
  ): groupBy is PeriodGroupBy {
    return (
      groupBy === 'day' ||
      groupBy === 'week' ||
      groupBy === 'month' ||
      groupBy === 'year'
    );
  }

  private toNumber(value: RawValue): number {
    if (value === null || value === undefined) {
      return 0;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
