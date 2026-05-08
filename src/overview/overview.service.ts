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
  OVERVIEW_PROVIDERS,
  OverviewDateRangeQueryDto,
  OverviewProvider,
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
const UNKNOWN_GROUP = 'Unknown';

type RawValue = string | number | null | undefined;
type PeriodGroupBy = 'day' | 'week' | 'month';
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
  profit: number;
  profitMarginPercent: number;
}

interface FinancialGroupValue extends FinancialValue {
  group: string;
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
      const aggregates = await this.getProviderAggregates(query);
      return {
        data: OVERVIEW_PROVIDERS.map((provider) => {
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

    const rowsByBucket = new Map<string, ProviderSeriesRow>();
    for (const row of rawRows) {
      const date = this.formatBucket(row.bucket);
      const item = rowsByBucket.get(date) ?? this.createProviderSeriesRow(date);
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
      providers: [...OVERVIEW_PROVIDERS],
      series: [...rowsByBucket.values()],
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
      .addSelect(`COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndPrice"), 0)`, 'revenue')
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

  private async getSummaryTotalRevenue(
    query: OverviewProviderFilterQueryDto,
  ): Promise<number> {
    if (query.provider) {
      const raw = await this.createCompletedItemsQuery(ORDER_ITEM_ALIAS, query)
        .select(
          `COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndPrice"), 0)`,
          'totalRevenue',
        )
        .getRawOne<{ totalRevenue?: RawValue }>();

      return this.toNumber(raw?.totalRevenue);
    }

    const revenueQb = this.ordersRepository.createQueryBuilder(ORDER_ALIAS);
    this.applyDateRange(revenueQb, ORDER_ALIAS, query);

    const raw = await revenueQb
      .select(
        `COALESCE(SUM(CASE WHEN ${ORDER_ALIAS}.status IN (:...completedOrderStatuses) THEN ${ORDER_ALIAS}."vndPrice" ELSE 0 END), 0)`,
        'totalRevenue',
      )
      .setParameter('completedOrderStatuses', [...COMPLETED_ORDER_STATUSES])
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
  ): Promise<Map<OverviewProvider, ProviderAggregate>> {
    const rawRows = await this.createProviderBaseQuery(query)
      .select(`${PLAN_ALIAS}.provider`, 'provider')
      .addSelect(this.completedOrdersCountExpression(), 'orders')
      .addSelect(this.completedItemsSumExpression('vndPrice'), 'revenue')
      .addSelect(this.completedItemsSumExpression('quantity'), 'plansSold')
      .addSelect(this.completedItemsCountExpression(), 'completedItems')
      .addSelect(`COUNT(${ORDER_ITEM_ALIAS}.id)`, 'totalItems')
      .groupBy(`${PLAN_ALIAS}.provider`)
      .getRawMany<{
        provider: OverviewProvider;
        orders: RawValue;
        revenue: RawValue;
        plansSold: RawValue;
        completedItems: RawValue;
        totalItems: RawValue;
      }>();

    return new Map<OverviewProvider, ProviderAggregate>(
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
        `COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndPrice"), 0)`,
        'totalRevenue',
      )
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{
        bucket: RawValue;
        costPrice: RawValue;
        totalRevenue: RawValue;
      }>();

    return rawRows.map((row) => ({
      date: this.formatBucket(row.bucket),
      ...this.createFinancialValue(row.costPrice, row.totalRevenue),
    }));
  }

  private async getFinancialGroups(
    query: FinancialComparisonQueryDto,
    groupBy: Exclude<FinancialComparisonGroupBy, PeriodGroupBy>,
  ): Promise<FinancialGroupValue[]> {
    const qb = this.createCompletedItemsQuery(ORDER_ITEM_ALIAS, query);

    if (groupBy === 'provider') {
      const rows = await qb
        .select(`${PLAN_ALIAS}.provider`, 'group')
        .addSelect(
          `COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndCostPrice"), 0)`,
          'costPrice',
        )
        .addSelect(
          `COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndPrice"), 0)`,
          'totalRevenue',
        )
        .groupBy(`${PLAN_ALIAS}.provider`)
        .orderBy('"totalRevenue"', 'DESC')
        .getRawMany<{
          group: OverviewProvider;
          costPrice: RawValue;
          totalRevenue: RawValue;
        }>();

      const byProvider = new Map<string, FinancialGroupValue>(
        rows.map((row) => [
          row.group,
          {
            group: row.group,
            ...this.createFinancialValue(row.costPrice, row.totalRevenue),
          },
        ]),
      );

      return OVERVIEW_PROVIDERS.map(
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
        `COALESCE(SUM(${ORDER_ITEM_ALIAS}."vndPrice"), 0)`,
        'totalRevenue',
      )
      .groupBy(destinationGroupExpression)
      .addGroupBy(destinationNameExpression)
      .orderBy('"totalRevenue"', 'DESC')
      .limit(limit)
      .getRawMany<{
        group: string;
        costPrice: RawValue;
        totalRevenue: RawValue;
      }>();

    return rows.map((row) => ({
      group: row.group,
      ...this.createFinancialValue(row.costPrice, row.totalRevenue),
    }));
  }

  private createProviderBaseQuery(
    query: OverviewDateRangeQueryDto,
  ): OrderItemQuery {
    const qb = this.orderItemsRepository
      .createQueryBuilder(ORDER_ITEM_ALIAS)
      .innerJoin(`${ORDER_ITEM_ALIAS}.order`, ORDER_ALIAS)
      .innerJoin(`${ORDER_ITEM_ALIAS}.plan`, PLAN_ALIAS)
      .where(`${PLAN_ALIAS}.provider IN (:...providers)`, {
        providers: [...OVERVIEW_PROVIDERS],
      })
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
    if (query.from) {
      qb.andWhere(`${alias}."createdAt" >= :from`, {
        from: new Date(query.from),
      });
    }

    if (query.to) {
      qb.andWhere(`${alias}."createdAt" <= :to`, {
        to: new Date(query.to),
      });
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
        : `${ORDER_ITEM_ALIAS}."vndPrice"`;

    return `COALESCE(SUM(CASE WHEN ${ORDER_ALIAS}.status IN (:...completedOrderStatuses) AND ${ORDER_ITEM_ALIAS}.status IN (:...completedOrderItemStatuses) THEN ${columnExpression} ELSE 0 END), 0)`;
  }

  private getDateBucketExpression(groupBy: PeriodGroupBy): string {
    if (groupBy === 'week') {
      return `TO_CHAR(DATE_TRUNC('week', ${ORDER_ALIAS}."createdAt"), 'IYYY-IW')`;
    }

    if (groupBy === 'month') {
      return `TO_CHAR(DATE_TRUNC('month', ${ORDER_ALIAS}."createdAt"), 'YYYY-MM')`;
    }

    return `TO_CHAR(DATE_TRUNC('day', ${ORDER_ALIAS}."createdAt"), 'YYYY-MM-DD')`;
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

  private createProviderSeriesRow(date: string): ProviderSeriesRow {
    return OVERVIEW_PROVIDERS.reduce<ProviderSeriesRow>(
      (row, provider) => {
        row[provider] = 0;
        return row;
      },
      { date },
    );
  }

  private createEmptyProviderAggregate(
    provider: OverviewProvider,
  ): ProviderAggregate {
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
    rows: Array<Pick<FinancialValue, 'costPrice' | 'totalRevenue'>>,
  ): FinancialComparisonTotalsDto {
    const costPrice = rows.reduce((sum, row) => sum + row.costPrice, 0);
    const totalRevenue = rows.reduce((sum, row) => sum + row.totalRevenue, 0);
    return this.createFinancialValue(costPrice, totalRevenue);
  }

  private createFinancialValue(
    costPriceValue: RawValue,
    totalRevenueValue: RawValue,
  ): FinancialComparisonTotalsDto {
    const costPrice = this.toNumber(costPriceValue);
    const totalRevenue = this.toNumber(totalRevenueValue);
    const profit = totalRevenue - costPrice;

    return {
      costPrice: this.roundMoney(costPrice),
      totalRevenue: this.roundMoney(totalRevenue),
      profit: this.roundMoney(profit),
      profitMarginPercent:
        totalRevenue > 0 ? this.roundMoney((profit / totalRevenue) * 100) : 0,
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
    return groupBy === 'day' || groupBy === 'week' || groupBy === 'month';
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
