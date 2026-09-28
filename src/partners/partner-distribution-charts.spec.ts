import { PartnersService } from './partners.service';

/**
 * The distribution partner's charts (#045).
 *
 * Two questions the KPI tiles cannot answer: how the buying moved over the
 * period, and which destinations are actually selling. The first needs two
 * different dates — an order counts on the day it was placed, an eSIM on the
 * day the customer switched it on, which is usually later — so the two are
 * counted separately and folded together by bucket.
 */

function buildService(
  orderRows: Record<string, unknown>[],
  esimRows: Record<string, unknown>[],
) {
  const query = jest
    .fn()
    .mockResolvedValueOnce(orderRows)
    .mockResolvedValueOnce(esimRows);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    dataSource: { query },
    getPartnerOrThrowById: jest
      .fn()
      .mockResolvedValue({ id: 8, userId: 100, partnerType: 'distribution' }),
  });

  return { service, query };
}

describe('PartnersService.getMyDistributionSeries (#045)', () => {
  it('should put an order and an activation from the same day in one bucket', async () => {
    const { service } = buildService(
      [{ bucket: '2026-09-01T00:00:00.000Z', orders: '4' }],
      [{ bucket: '2026-09-01T00:00:00.000Z', activatedEsims: '2' }],
    );

    await expect(service.getMyDistributionSeries(8)).resolves.toEqual([
      {
        bucket: '2026-09-01T00:00:00.000Z',
        orders: 4,
        activatedEsims: 2,
      },
    ]);
  });

  it('should keep a day that only has activations', async () => {
    // eSIMs bought last month, switched on today: the bucket has no order in
    // it and dropping it would hide the activation entirely.
    const { service } = buildService(
      [{ bucket: '2026-09-01T00:00:00.000Z', orders: '4' }],
      [{ bucket: '2026-09-05T00:00:00.000Z', activatedEsims: '3' }],
    );

    await expect(service.getMyDistributionSeries(8)).resolves.toEqual([
      { bucket: '2026-09-01T00:00:00.000Z', orders: 4, activatedEsims: 0 },
      { bucket: '2026-09-05T00:00:00.000Z', orders: 0, activatedEsims: 3 },
    ]);
  });

  it('should return the buckets oldest first', async () => {
    const { service } = buildService(
      [
        { bucket: '2026-09-10T00:00:00.000Z', orders: '1' },
        { bucket: '2026-09-02T00:00:00.000Z', orders: '2' },
      ],
      [],
    );

    const result = await service.getMyDistributionSeries(8);

    expect(result.map((point) => point.orders)).toEqual([2, 1]);
  });

  it('should bucket by the granularity asked for', async () => {
    const { service, query } = buildService([], []);

    await service.getMyDistributionSeries(8, {}, 'month');

    const [orderSql] = query.mock.calls[0] as [string];
    const [esimSql] = query.mock.calls[1] as [string];
    expect(orderSql).toContain("date_trunc('month'");
    expect(esimSql).toContain("date_trunc('month'");
  });

  it('should refuse a granularity it does not know', async () => {
    // The unit is interpolated into the SQL, so nothing but the four known
    // words may ever reach it.
    const { service, query } = buildService([], []);

    await service.getMyDistributionSeries(
      8,
      {},
      "day'); DROP TABLE partner; --" as unknown as 'day',
    );

    const [orderSql] = query.mock.calls[0] as [string];
    expect(orderSql).toContain("date_trunc('day'");
    expect(orderSql).not.toContain('DROP TABLE');
  });

  it('should count the partner own orders', async () => {
    const { service, query } = buildService([], []);

    await service.getMyDistributionSeries(8);

    const [orderSql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(orderSql).toContain('o."userId" = $1');
    expect(params[0]).toBe(100);
  });
});

describe('PartnersService.getMyTopDestinations — whose orders (#045)', () => {
  function buildForDestinations() {
    const query = jest.fn().mockResolvedValue([]);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      dataSource: { query },
      getPartnerOrThrowById: jest
        .fn()
        .mockResolvedValue({ id: 8, userId: 100 }),
    });
    return { service, query };
  }

  it('should count orders attributed to a marketing partner', async () => {
    const { service, query } = buildForDestinations();

    await service.getMyTopDestinations(8, {}, 6);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('o."attributedPartnerId" = $1');
    expect(params[0]).toBe(8);
  });

  it('should count a distribution partner own purchases instead', async () => {
    const { service, query } = buildForDestinations();

    await service.getMyTopDestinations(8, {}, 6, 'own');

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('o."userId" = $1');
    expect(sql).not.toContain('attributedPartnerId');
    // Keyed off the user account, because that is who placed the orders.
    expect(params[0]).toBe(100);
  });
});
