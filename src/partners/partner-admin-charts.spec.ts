import { PartnersService } from './partners.service';

/**
 * The admin partner charts (#052).
 *
 * The same money as #050 — what esim.vn keeps, not what the orders were rung up
 * at — cut into buckets so the shape of a period is visible. Getting this wrong
 * in the other direction would be worse than having no chart: a line drawn from
 * gross order value says the programme is twice the size it is.
 */

function buildService(rows: Record<string, unknown>[]) {
  const query = jest.fn().mockResolvedValue(rows);
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

describe('PartnersService.adminPartnerSeries (#052)', () => {
  it('should group the types inside one bucket', async () => {
    const { service } = buildService([
      {
        bucket: '2026-09-01T00:00:00.000Z',
        partnerType: 'kol',
        revenueVnd: '82000000',
        orders: '128',
      },
      {
        bucket: '2026-09-01T00:00:00.000Z',
        partnerType: 'distribution',
        revenueVnd: '50000000',
        orders: '12',
      },
    ]);

    const result = await service.adminPartnerSeries();

    expect(result.points).toEqual([
      {
        bucket: '2026-09-01T00:00:00.000Z',
        byType: [
          { partnerType: 'distribution', revenueVnd: 50_000_000, orders: 12 },
          { partnerType: 'kol', revenueVnd: 82_000_000, orders: 128 },
        ],
      },
    ]);
  });

  it('should return the buckets oldest first', async () => {
    const { service } = buildService([
      {
        bucket: '2026-09-10T00:00:00.000Z',
        partnerType: 'kol',
        revenueVnd: '1',
        orders: '1',
      },
      {
        bucket: '2026-09-02T00:00:00.000Z',
        partnerType: 'kol',
        revenueVnd: '2',
        orders: '2',
      },
    ]);

    const result = await service.adminPartnerSeries();

    expect(result.points.map((p) => p.byType[0].revenueVnd)).toEqual([2, 1]);
  });

  it('should take the commission off the affiliate side of the chart', async () => {
    const { service, query } = buildService([]);

    await service.adminPartnerSeries();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('order_partner_commission');
    expect(sql).toContain('reversedCommissionVnd');
    // And count the distribution side at what the partner paid.
    expect(sql).toContain('p."userId" = o."userId"');
  });

  it('should count an order once when a partner could match both sides', async () => {
    const { service, query } = buildService([]);

    await service.adminPartnerSeries();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('COUNT(DISTINCT t."orderId")');
    // An order credited to somebody else is not the buyer's own revenue.
    expect(sql).toContain(
      'o."attributedPartnerId" IS NULL OR o."attributedPartnerId" = p.id',
    );
  });

  it('should bucket by the granularity asked for', async () => {
    const { service, query } = buildService([]);

    await service.adminPartnerSeries({}, 'month');

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain("date_trunc('month'");
  });

  it('should refuse a granularity it does not know', async () => {
    // The unit is interpolated into the SQL, so only the four known words may
    // ever reach it.
    const { service, query } = buildService([]);

    await service.adminPartnerSeries(
      {},
      "day'); DROP TABLE partner; --" as never,
    );

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain("date_trunc('day'");
    expect(sql).not.toContain('DROP TABLE');
  });
});

describe('PartnersService.adminPartnerTopDestinations (#052)', () => {
  it('should rank destinations by eSIMs sold', async () => {
    const { service } = buildService([
      { name: 'Nhật Bản', plansPurchased: '120', revenueVnd: '240000000' },
      { name: 'Hàn Quốc', plansPurchased: '80', revenueVnd: '150000000' },
    ]);

    await expect(service.adminPartnerTopDestinations()).resolves.toEqual([
      { name: 'Nhật Bản', plansPurchased: 120, revenueVnd: 240_000_000 },
      { name: 'Hàn Quốc', plansPurchased: 80, revenueVnd: 150_000_000 },
    ]);
  });

  it('should count only orders a partner was part of', async () => {
    const { service, query } = buildService([]);

    await service.adminPartnerTopDestinations();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('o."attributedPartnerId" IS NOT NULL');
    expect(sql).toContain('pa."userId" = o."userId"');
  });

  it('should cap how many rows one call can ask for', async () => {
    const { service, query } = buildService([]);

    await service.adminPartnerTopDestinations({}, 500);

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBe(30);
  });

  it('should name a destination that has none', async () => {
    const { service } = buildService([
      { name: null, plansPurchased: '3', revenueVnd: '0' },
    ]);

    await expect(service.adminPartnerTopDestinations()).resolves.toEqual([
      { name: 'Không xác định', plansPurchased: 3, revenueVnd: 0 },
    ]);
  });
});
