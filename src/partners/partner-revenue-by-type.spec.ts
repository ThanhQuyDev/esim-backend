import { PartnersService } from './partners.service';

/**
 * What esim.vn keeps from each kind of partner (#050).
 *
 * The brief is explicit and easy to get wrong: "doanh thu của đối tác là số
 * tiền mà esim.vn thu về thực tế" — for a marketing partner that is the order
 * value *after* their commission is paid away, for a distribution or API
 * partner it is the price they paid us for the eSIMs. Reading it as gross order
 * value would make the affiliate programme look far more profitable than it is.
 */

function buildService(rows: {
  attributed?: Record<string, unknown>[];
  purchases?: Record<string, unknown>[];
  counts?: Record<string, unknown>[];
}) {
  const query = jest
    .fn()
    .mockResolvedValueOnce(rows.attributed ?? [])
    .mockResolvedValueOnce(rows.purchases ?? [])
    .mockResolvedValueOnce(rows.counts ?? []);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

describe('PartnersService.adminRevenueByPartnerType (#050)', () => {
  it('should take the commission off a marketing partner’s orders', async () => {
    // 100tr credited to KOLs, 18tr paid away: esim.vn kept 82tr.
    const { service } = buildService({
      attributed: [
        {
          partnerType: 'kol',
          grossVnd: '100000000',
          commissionVnd: '18000000',
          prevGrossVnd: '80000000',
          prevCommissionVnd: '14000000',
        },
      ],
      counts: [{ partnerType: 'kol', partners: '12' }],
    });

    const result = await service.adminRevenueByPartnerType();
    const kol = result.byType.find((r) => r.partnerType === 'kol')!;

    expect(kol.revenueVnd).toBe(82_000_000);
    expect(kol.previousRevenueVnd).toBe(66_000_000);
    expect(kol.partners).toBe(12);
  });

  it('should count a distribution partner’s buying price as the revenue', async () => {
    const { service } = buildService({
      purchases: [
        {
          partnerType: 'distribution',
          purchasesVnd: '134650000',
          prevPurchasesVnd: '120000000',
        },
      ],
      counts: [{ partnerType: 'distribution', partners: '4' }],
    });

    const result = await service.adminRevenueByPartnerType();
    const dist = result.byType.find((r) => r.partnerType === 'distribution')!;

    expect(dist.revenueVnd).toBe(134_650_000);
    expect(dist.commissionVnd).toBe(0);
  });

  it('should add both sides for a distributor who also earns commission', async () => {
    // #048 lets a distributor run the affiliate programme as well; esim.vn
    // keeps what they paid for stock plus what their referrals left behind.
    const { service } = buildService({
      attributed: [
        {
          partnerType: 'distribution',
          grossVnd: '10000000',
          commissionVnd: '1500000',
          prevGrossVnd: '0',
          prevCommissionVnd: '0',
        },
      ],
      purchases: [
        {
          partnerType: 'distribution',
          purchasesVnd: '50000000',
          prevPurchasesVnd: '0',
        },
      ],
      counts: [{ partnerType: 'distribution', partners: '1' }],
    });

    const result = await service.adminRevenueByPartnerType();
    const dist = result.byType.find((r) => r.partnerType === 'distribution')!;

    expect(dist.revenueVnd).toBe(58_500_000);
  });

  it('should compare against the same span immediately before', async () => {
    const { service, query } = buildService({});

    const result = await service.adminRevenueByPartnerType({
      from: '2026-09-01',
      to: '2026-09-30',
    });

    const span =
      new Date(result.range.to).getTime() -
      new Date(result.range.from).getTime();
    const prevSpan =
      new Date(result.previousRange.to).getTime() -
      new Date(result.previousRange.from).getTime();
    expect(prevSpan).toBe(span);
    // The previous window ends exactly where this one starts.
    expect(result.previousRange.to).toBe(result.range.from);
    // Both windows go to the database as parameters, never interpolated.
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toHaveLength(5);
  });

  it('should read growth as a percentage of the previous period', async () => {
    const { service } = buildService({
      purchases: [
        {
          partnerType: 'distribution',
          purchasesVnd: '150',
          prevPurchasesVnd: '100',
        },
      ],
      counts: [{ partnerType: 'distribution', partners: '1' }],
    });

    const result = await service.adminRevenueByPartnerType();

    expect(result.byType[0].growthPercent).toBe(50);
    expect(result.growthPercent).toBe(50);
  });

  it('should call a first-ever period growth rather than divide by nothing', async () => {
    const { service } = buildService({
      purchases: [
        {
          partnerType: 'distribution',
          purchasesVnd: '5000000',
          prevPurchasesVnd: '0',
        },
      ],
      counts: [{ partnerType: 'distribution', partners: '1' }],
    });

    const result = await service.adminRevenueByPartnerType();

    expect(result.byType[0].growthPercent).toBe(100);
  });

  it('should list a type that has partners but no revenue yet', async () => {
    // A programme with sign-ups and no orders is a real state, and hiding it
    // would read as "we have no API partners".
    const { service } = buildService({
      counts: [{ partnerType: 'api', partners: '3' }],
    });

    const result = await service.adminRevenueByPartnerType();

    expect(result.byType).toEqual([
      expect.objectContaining({
        partnerType: 'api',
        partners: 3,
        revenueVnd: 0,
      }),
    ]);
  });

  it('should total the types into one figure', async () => {
    const { service } = buildService({
      attributed: [
        {
          partnerType: 'kol',
          grossVnd: '100',
          commissionVnd: '20',
          prevGrossVnd: '50',
          prevCommissionVnd: '10',
        },
      ],
      purchases: [
        {
          partnerType: 'distribution',
          purchasesVnd: '200',
          prevPurchasesVnd: '100',
        },
      ],
      counts: [
        { partnerType: 'kol', partners: '2' },
        { partnerType: 'distribution', partners: '1' },
      ],
    });

    const result = await service.adminRevenueByPartnerType();

    expect(result.totalRevenueVnd).toBe(280);
    expect(result.previousTotalRevenueVnd).toBe(140);
  });
});
