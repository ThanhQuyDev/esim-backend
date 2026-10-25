import {
  OverviewInsightsService,
  overviewRange,
} from './overview-insights.service';

/** Tổng quan KPI cards and audience charts (vande #059). */
function service(answers: (sql: string) => unknown[]) {
  const query = jest.fn((sql: string) => Promise.resolve(answers(sql)));
  return {
    svc: new OverviewInsightsService({ query } as never),
    query,
  };
}

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

describe('recording a visit (vande #059)', () => {
  it('should keep the device, the system and the city — never the address', async () => {
    const { svc, query } = service(() => [{ id: 1 }]);

    await expect(
      svc.recordVisit({
        visitorId: 'abc-12345',
        userAgent: IPHONE,
        ip: '14.161.22.33',
      }),
    ).resolves.toEqual({ recorded: true });

    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT ("visitorId", day) DO NOTHING');
    expect(params).toEqual([
      'abc-12345',
      'mobile',
      'iOS',
      'VN',
      'Ho Chi Minh City',
    ]);
    expect(JSON.stringify(params)).not.toContain('14.161');
  });

  it('should count a browser as new only the first day it is seen', async () => {
    const { svc, query } = service(() => [{ id: 1 }]);
    await svc.recordVisit({
      visitorId: 'abc-12345',
      userAgent: IPHONE,
      ip: null,
    });
    expect(query.mock.calls[0][0]).toContain(
      'NOT EXISTS (SELECT 1 FROM site_visit WHERE "visitorId" = $1::varchar)',
    );
  });

  it('should ignore bots', async () => {
    const { svc, query } = service(() => []);
    await expect(
      svc.recordVisit({
        visitorId: 'abc-12345',
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        ip: '8.8.8.8',
      }),
    ).resolves.toEqual({ recorded: false });
    expect(query).not.toHaveBeenCalled();
  });
});

describe('the KPI cards (vande #059)', () => {
  it('should leave the partner wallet purchases out of web sales', async () => {
    const { svc, query } = service(() => [{}]);
    await svc.getKpis({ preset: 'last7days' });
    const sales = (query.mock.calls as unknown as [string][]).filter(
      ([sql]) => sql.includes('itemNetRevenue') || sql.includes('AS revenue'),
    );
    expect(sales[0][0]).toContain(
      `o."paymentMethod" IS DISTINCT FROM 'partner_wallet'`,
    );
  });

  it('should work out gross profit and conversion', async () => {
    const { svc } = service((sql) => {
      if (sql.includes('AS revenue'))
        return [
          {
            revenue: '10000000',
            cost: '6000000',
            commission: '500000',
            plans: '40',
          },
        ];
      if (sql.includes('"selfPaid"'))
        return [{ paid: '25', failed: '2', selfPaid: '20', esims: '31' }];
      if (sql.includes('AS visits')) return [{ visits: '400' }];
      return [{}];
    });

    const kpis = await svc.getKpis({ preset: 'last7days' });

    expect(kpis.revenue).toEqual({
      netRevenueVnd: 10_000_000,
      costVnd: 6_000_000,
      partnerCommissionVnd: 500_000,
      grossProfitVnd: 3_500_000,
    });
    expect(kpis.orders).toEqual({
      paidOrders: 25,
      esimsSold: 31,
      visits: 400,
      conversionPercent: 5,
    });
    expect(kpis.customers).toMatchObject({ plansSold: 40, failedOrders: 2 });
  });

  it('should show no conversion rate before any visit was recorded', async () => {
    const { svc } = service(() => [{}]);
    expect((await svc.getKpis({})).orders.conversionPercent).toBeNull();
  });
});

describe('the audience charts (vande #059)', () => {
  it('should put visits and orders side by side and group cities under countries', async () => {
    const { svc } = service((sql) => {
      if (sql.includes('v."deviceType"'))
        return [
          { key: 'mobile', n: '30' },
          { key: 'desktop', n: '10' },
        ];
      if (sql.includes('o."deviceType"')) return [{ key: 'mobile', n: '3' }];
      if (sql.includes('v."isNew"'))
        return [
          { key: 'new', n: '28' },
          { key: 'returning', n: '12' },
        ];
      if (sql.includes('prior')) return [{ key: 'returning', n: '2' }];
      if (sql.includes('GROUP BY 1, 2'))
        return [
          { country: 'VN', city: 'Hanoi', visitors: '6' },
          { country: 'VN', city: 'Ho Chi Minh City', visitors: '12' },
          { country: 'US', city: null, visitors: '2' },
        ];
      if (sql.includes('AS total')) return [{ total: '20' }];
      if (sql.includes('GROUP BY 1') && sql.includes('v.country'))
        return [
          { country: 'VN', n: '18' },
          { country: 'US', n: '2' },
        ];
      return [];
    });

    const audience = await svc.getAudience({ preset: 'last30days' });

    expect(audience.devices).toEqual([
      { deviceType: 'desktop', visits: 10, orders: 0 },
      { deviceType: 'mobile', visits: 30, orders: 3 },
      { deviceType: 'tablet', visits: 0, orders: 0 },
    ]);
    expect(audience.customers).toEqual([
      { kind: 'new', visits: 28, orders: 0 },
      { kind: 'returning', visits: 12, orders: 2 },
    ]);
    expect(audience.countries[0]).toMatchObject({
      country: 'VN',
      name: 'Việt Nam',
      visitors: 18,
      percent: 90,
      cities: [
        { city: 'Ho Chi Minh City', visitors: 12, percent: 66.7 },
        { city: 'Hanoi', visitors: 6, percent: 33.3 },
      ],
    });
    expect(audience.countries[1].cities[0].city).toBe('Không rõ thành phố');
  });
});

describe('overviewRange', () => {
  it('should turn "today" into Hanoi midnight to midnight', () => {
    const range = overviewRange({ preset: 'today' });
    expect(new Date(range.from!).getUTCHours()).toBe(17);
  });
});
