import { PartnersService } from './partners.service';

/**
 * The distribution partner's own dashboard (#043).
 *
 * A marketing partner asks "what did I earn?"; a distribution partner buys the
 * eSIMs and resells them, so they ask what they bought, what fell over, what
 * they spent — eSIMs and top-ups apart — and how much of it has actually been
 * switched on. An eSIM nobody activated is stock, not a sale.
 */

function buildService(
  rows: {
    orders?: Record<string, unknown>;
    esims?: Record<string, unknown>;
  } = {},
) {
  const query = jest
    .fn()
    .mockResolvedValueOnce([
      {
        esimOrders: '8',
        esimCancelled: '1',
        esimRevenueVnd: '2400000',
        topupOrders: '3',
        topupCancelled: '0',
        topupRevenueVnd: '150000',
        ...(rows.orders ?? {}),
      },
    ])
    .mockResolvedValueOnce([
      {
        activatedCount: '5',
        activatedRevenueVnd: '1500000',
        ...(rows.esims ?? {}),
      },
    ]);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    dataSource: { query },
    getPartnerOrThrowById: jest
      .fn()
      .mockResolvedValue({ id: 8, userId: 100, partnerType: 'distribution' }),
  });

  return { service, query };
}

describe('PartnersService.getMyDistributionSummary (#043)', () => {
  it('should split eSIM buying from top-ups and add both into the total', async () => {
    const { service } = buildService();

    await expect(service.getMyDistributionSummary(8)).resolves.toMatchObject({
      total: { orders: 11, cancelledOrders: 1, revenueVnd: 2_550_000 },
      esim: { orders: 8, cancelledOrders: 1, revenueVnd: 2_400_000 },
      topup: { orders: 3, cancelledOrders: 0, revenueVnd: 150_000 },
      activatedEsims: { count: 5, revenueVnd: 1_500_000 },
    });
  });

  it('should count the partner own purchases, not orders credited to them', async () => {
    // The difference that matters: a distribution partner's dashboard is about
    // what they bought, so the query keys off their user account.
    const { service, query } = buildService();

    await service.getMyDistributionSummary(8);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('o."userId" = $1');
    expect(sql).not.toContain('attributedPartnerId');
    expect(params[0]).toBe(100);
  });

  it('should leave cancelled orders out of what was spent', async () => {
    const { service, query } = buildService();

    await service.getMyDistributionSummary(8);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    // Cancellations are counted, but only settled orders add to the money.
    expect(params).toContain('TOPUP');
    expect(params[4]).toEqual(['cancelled', 'failed', 'refunded']);
    expect(params[5]).toEqual(['paid', 'completed']);
    expect(sql).toContain('"esimCancelled"');
  });

  it('should count an activation by when it happened, inside the window', async () => {
    const { service, query } = buildService();

    await service.getMyDistributionSummary(8, {
      from: '2026-09-01',
      to: '2026-09-30',
    });

    const [sql] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('e."activatedAt" IS NOT NULL');
    expect(sql).toContain('e."activatedAt" >= $2');
    // One eSIM out of a line of five is worth a fifth of the line.
    expect(sql).toContain('NULLIF(oi.quantity, 0)');
  });

  it('should read zeroes as zeroes for a partner who has bought nothing', async () => {
    const { service } = buildService({
      orders: {
        esimOrders: '0',
        esimCancelled: '0',
        esimRevenueVnd: '0',
        topupOrders: '0',
        topupCancelled: '0',
        topupRevenueVnd: '0',
      },
      esims: { activatedCount: '0', activatedRevenueVnd: '0' },
    });

    await expect(service.getMyDistributionSummary(8)).resolves.toMatchObject({
      total: { orders: 0, cancelledOrders: 0, revenueVnd: 0 },
      activatedEsims: { count: 0, revenueVnd: 0 },
    });
  });

  it('should echo the window back for the page header', async () => {
    const { service } = buildService();

    const result = await service.getMyDistributionSummary(8, {
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(new Date(result.range.from).getDate()).toBe(1);
    // Inclusive day bounds: the end is the start of the following day.
    expect(new Date(result.range.to).getDate()).toBe(1);
    expect(new Date(result.range.to).getMonth()).toBe(9);
  });
});
