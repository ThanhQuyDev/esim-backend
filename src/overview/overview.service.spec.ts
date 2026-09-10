import {
  itemNetRevenueSql,
  orderNetRevenueSql,
  OverviewService,
  vietnamBoundaryFromInput,
  vietnamDayRangeUtc,
} from './overview.service';
import {
  COMPLETED_ORDER_ITEM_STATUSES,
  COMPLETED_ORDER_STATUSES,
} from './dto/overview.dto';

describe('Vietnam overview date boundaries', () => {
  it('should start today at 00:00 Vietnam time (17:00 UTC previous day)', () => {
    const range = vietnamDayRangeUtc(new Date('2026-09-01T02:30:00.000Z'));

    expect(range.from.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-09-01T16:59:59.999Z');
  });

  it('should keep the Vietnam date after UTC crosses midnight', () => {
    const range = vietnamDayRangeUtc(new Date('2026-09-01T20:00:00.000Z'));

    expect(range.from.toISOString()).toBe('2026-09-01T17:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-09-02T16:59:59.999Z');
  });

  it('should support previous-day offsets across month boundaries', () => {
    const range = vietnamDayRangeUtc(new Date('2026-09-01T02:30:00.000Z'), -1);

    expect(range.from.toISOString()).toBe('2026-08-30T17:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-08-31T16:59:59.999Z');
  });
});

describe('Vietnam boundaries from CMS date-picker input', () => {
  it('should expand a date-only start into 00:00 Vietnam time', () => {
    expect(vietnamBoundaryFromInput('2026-09-01', 'start').toISOString()).toBe(
      '2026-08-31T17:00:00.000Z',
    );
  });

  it('should expand a date-only end into 23:59:59.999 Vietnam time', () => {
    expect(vietnamBoundaryFromInput('2026-09-01', 'end').toISOString()).toBe(
      '2026-09-01T16:59:59.999Z',
    );
  });

  it('should cover a full single-day range without dropping the first hours', () => {
    const from = vietnamBoundaryFromInput('2026-09-01', 'start');
    const to = vietnamBoundaryFromInput('2026-09-01', 'end');

    // An order placed at 08:00 Vietnam time (01:00 UTC) must be inside the range.
    const morningOrder = new Date('2026-09-01T01:00:00.000Z');
    expect(morningOrder >= from && morningOrder <= to).toBe(true);
  });

  it('should pass through timestamps that already carry a time and zone', () => {
    const explicit = '2026-09-01T10:15:00.000Z';
    expect(vietnamBoundaryFromInput(explicit, 'start').toISOString()).toBe(
      explicit,
    );
  });
});

/**
 * Revenue and profit on the Tổng quan screen must be NET — after the coupon
 * ("khuyến mãi") and referral ("giới thiệu") discounts. The formula lives in
 * SQL, so it cannot be exercised without a database; these tests instead pin
 * its shape, which is enough to catch the regression that matters: someone
 * summing the raw `vndPrice` again and quietly overstating profit.
 */
describe('Overview net revenue formula', () => {
  const sql = orderNetRevenueSql('purchase_order');

  it('should subtract both the coupon and the referral discount', () => {
    expect(sql).toContain('"couponDiscountVndAmount"');
    expect(sql).toContain('"referralDiscountVndAmount"');
    expect(sql).toContain('"subtotalVndPrice" - ');
  });

  it('should never let discounts push an order below zero revenue', () => {
    expect(sql).toContain('GREATEST(');
  });

  it('should fall back to the stored total for orders with no subtotal', () => {
    // Orders created before the discount columns existed have subtotal 0.
    expect(sql).toContain('ELSE purchase_order."vndPrice" END');
  });

  it('should spread an order-level discount across its lines, not duplicate it', () => {
    const itemSql = itemNetRevenueSql('purchase_order', 'order_item');

    // line price ÷ order subtotal × net order revenue
    expect(itemSql).toContain('order_item."vndPrice" * ');
    expect(itemSql).toContain('/ purchase_order."subtotalVndPrice"');
    expect(itemSql).toContain('"couponDiscountVndAmount"');
    expect(itemSql).toContain('"referralDiscountVndAmount"');
  });

  it('should be the same formula everywhere, not a second copy', () => {
    expect(itemNetRevenueSql('purchase_order', 'order_item')).toContain(sql);
  });
});

/**
 * A refunded order must not show up in cost, revenue or profit on the Tổng quan
 * screen. That is enforced by the status allow-list every money query is gated
 * on, so these tests guard the allow-list itself — the one place where adding
 * "refunded" would silently put the money back into the reports.
 */
describe('Refunded orders are excluded from the overview figures', () => {
  it('should count only paid orders as revenue-bearing', () => {
    expect([...COMPLETED_ORDER_STATUSES]).toEqual(['paid']);
    expect([...COMPLETED_ORDER_STATUSES]).not.toContain('refunded');
  });

  it('should count only completed order items', () => {
    expect([...COMPLETED_ORDER_ITEM_STATUSES]).toEqual(['completed']);
    expect([...COMPLETED_ORDER_ITEM_STATUSES]).not.toContain('refunded');
    expect([...COMPLETED_ORDER_ITEM_STATUSES]).not.toContain('cancelled');
  });

  it('should gate every money query on both allow-lists', async () => {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    const qb: Record<string, jest.Mock> = {};
    const chain =
      (fn?: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        fn?.(...args);
        return qb;
      };
    const record = (sql: unknown, p?: unknown) => {
      conditions.push(String(sql));
      Object.assign(params, (p as Record<string, unknown>) ?? {});
    };

    qb.innerJoin = jest.fn(chain());
    qb.leftJoin = jest.fn(chain());
    qb.where = jest.fn(chain(record));
    qb.andWhere = jest.fn(chain(record));
    qb.select = jest.fn(chain());
    qb.addSelect = jest.fn(chain());
    qb.groupBy = jest.fn(chain());
    qb.addGroupBy = jest.fn(chain());
    qb.orderBy = jest.fn(chain());
    qb.addOrderBy = jest.fn(chain());
    qb.limit = jest.fn(chain());
    qb.getRawMany = jest.fn().mockResolvedValue([]);
    qb.getRawOne = jest.fn().mockResolvedValue({});

    const service = new OverviewService(
      {} as never,
      { createQueryBuilder: () => qb } as never,
      {} as never,
      {} as never,
    );

    await service.getFinancialComparison({ groupBy: 'provider' } as never);

    const whereSql = conditions.join(' ');
    expect(whereSql).toContain('completedOrderStatuses');
    expect(whereSql).toContain('completedOrderItemStatuses');
    expect(params.completedOrderStatuses).toEqual(['paid']);
    expect(params.completedOrderItemStatuses).toEqual(['completed']);
  });
});
