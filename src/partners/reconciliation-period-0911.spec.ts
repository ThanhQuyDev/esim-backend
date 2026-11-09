import { PartnersService, reconciliationPeriodRange } from './partners.service';

/**
 * doitac-0911 #004 — what a monthly commission statement counts:
 * only commissions APPROVED in the month (Vietnam time), and an order refunded
 * in full shows 0đ of commission, like its revenue.
 */
function serviceWith(rows: Record<string, unknown>[]) {
  const query = jest.fn().mockResolvedValue(rows);
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service as unknown as Record<string, unknown>, {
    dataSource: { query },
  });
  return { service, query };
}

describe('reconciliationPeriodRange (doitac-0911 #004)', () => {
  it('should run from 00:00 on the 1st to the end of the last day, Vietnam time', () => {
    const { from, to } = reconciliationPeriodRange('2026-10');
    expect(from.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });
});

describe('Monthly statement counts approved commissions only (doitac-0911 #004)', () => {
  it('should total by the time the commission was approved, not the order date', async () => {
    const { service, query } = serviceWith([]);

    await service.adminListReconciliations({ period: '2026-10' });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`c.status = 'credited'`);
    expect(sql).toContain('ct.id = c."rewardTransactionId"');
    expect(sql).not.toMatch(/o\."createdAt" >= \$1/);
    expect((params[0] as Date).toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect((params[1] as Date).toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('should list the same orders on the "Chi tiết giao dịch" sheet', async () => {
    const { service } = serviceWith([]);
    const getMyOrders = jest.fn().mockResolvedValue([]);
    (service as unknown as { getMyOrders: jest.Mock }).getMyOrders =
      getMyOrders;

    await service.partnerReconciliationTransactions(8, '2026-10');

    const filters = getMyOrders.mock.calls[0][2] as Record<string, Date>;
    expect(filters.from).toBeUndefined();
    expect(filters.creditedFrom.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(filters.creditedTo.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });
});

describe('A fully refunded order earns 0đ (doitac-0911 #004)', () => {
  const row = (over: Record<string, unknown>) => ({
    orderNumber: 'ORD-1',
    status: 'refunded',
    partnerId: 8,
    vndPrice: 92000,
    refundedAmountVnd: 92000,
    createdAt: new Date(),
    commissionVnd: 18400,
    commissionStatus: 'reversed',
    items: [],
    ...over,
  });

  it('should show 0đ and keep what it had earned', async () => {
    const { service } = serviceWith([row({})]);

    const [order] = await service.getMyOrders(8);

    expect(order.vndPrice).toBe(0);
    expect(order.commissionVnd).toBe(0);
    expect(order.originalCommissionVnd).toBe(18400);
  });

  it('should leave a credited commission as it is', async () => {
    const { service } = serviceWith([
      row({
        status: 'paid',
        refundedAmountVnd: 0,
        commissionStatus: 'credited',
      }),
    ]);

    const [order] = await service.getMyOrders(8);

    expect(order.commissionVnd).toBe(18400);
  });
});
