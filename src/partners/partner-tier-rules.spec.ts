import {
  PartnersService,
  partnerUnitPriceVnd,
  vnMonth,
} from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * How a partner earns a tier and what the tier is worth (#072, #073, #074).
 *
 * The two sides of the programme are promoted on different numbers: a
 * marketing partner on the orders credited to them, a distribution partner on
 * the orders they placed themselves OR on what they are holding on deposit.
 * An internal tier is negotiated rather than earned and the review must leave
 * it alone.
 */

const TIERS = [
  {
    tierCode: 'BRONZE',
    minVolumeVnd: '0',
    minDepositVnd: '0',
    isInternal: false,
  },
  {
    tierCode: 'SILVER',
    minVolumeVnd: '1000000',
    minDepositVnd: '0',
    isInternal: false,
  },
  {
    tierCode: 'GOLD',
    minVolumeVnd: '500000000',
    minDepositVnd: '100000000',
    isInternal: false,
  },
];

function buildService({
  partner,
  revenueVnd = '0',
  balanceVnd = '0',
  tiers = TIERS,
  currentTier = null,
  flags = {},
}: {
  partner: Record<string, unknown>;
  revenueVnd?: string;
  balanceVnd?: string;
  tiers?: Record<string, unknown>[];
  currentTier?: Record<string, unknown> | null;
  flags?: { reviewed?: boolean; held?: boolean };
}) {
  const savedPartners: Record<string, unknown>[] = [];
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    logger: { log: jest.fn(), error: jest.fn() },
    partnerRepository: {
      find: jest.fn().mockResolvedValue([partner]),
      save: jest.fn().mockImplementation((row) => {
        savedPartners.push({ ...row });
        return Promise.resolve(row);
      }),
    },
    walletRepository: {
      findOne: jest.fn().mockResolvedValue({ balanceVnd }),
    },
    tierRepository: {
      find: jest.fn().mockResolvedValue(tiers),
      findOne: jest.fn().mockResolvedValue(currentTier),
    },
    tierEvaluationRepository: {
      create: (row: unknown) => row,
      save: jest.fn().mockResolvedValue({}),
    },
    dataSource: {
      query: jest
        .fn()
        .mockImplementation((sql: string) =>
          Promise.resolve(
            sql.includes('"reviewed"')
              ? [flags]
              : [{ revenueVnd, validOrders: '4' }],
          ),
        ),
    },
  });

  return { service, savedPartners };
}

describe('PartnersService.runMonthlyTierReview (#072, #073)', () => {
  it('should promote a marketing partner on the orders credited to them', async () => {
    const { service, savedPartners } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: 'BRONZE' },
      revenueVnd: '2000000',
      currentTier: { tierCode: 'BRONZE', minVolumeVnd: '0', isInternal: false },
    });

    await service.runMonthlyTierReview();

    expect(savedPartners[0]).toMatchObject({ tierCode: 'SILVER' });
  });

  it("should read a marketing partner's revenue off the orders attributed to them", async () => {
    const { service } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: null },
    });

    await service.runMonthlyTierReview();

    const query = (service as unknown as { dataSource: { query: jest.Mock } })
      .dataSource.query;
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('attributedPartnerId');
  });

  it("should read a distribution partner's revenue off their own orders", async () => {
    // Their "doanh thu" is what they bought, not what they referred.
    const { service } = buildService({
      partner: {
        id: 8,
        partnerType: PartnerTypeEnum.DISTRIBUTION,
        tierCode: null,
      },
    });

    await service.runMonthlyTierReview();

    const query = (service as unknown as { dataSource: { query: jest.Mock } })
      .dataSource.query;
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).not.toContain('attributedPartnerId');
    expect(sql).toContain('p."userId" = o."userId"');
  });

  it('should promote a distribution partner on deposit alone', async () => {
    // 100 triệu on account earns Vàng even with no revenue behind it: the
    // brief makes the two routes alternatives, not a pair of conditions.
    const { service, savedPartners } = buildService({
      partner: {
        id: 8,
        partnerType: PartnerTypeEnum.DISTRIBUTION,
        tierCode: 'BRONZE',
      },
      revenueVnd: '0',
      balanceVnd: '100000000',
      currentTier: { tierCode: 'BRONZE', minVolumeVnd: '0', isInternal: false },
    });

    await service.runMonthlyTierReview();

    expect(savedPartners[0]).toMatchObject({ tierCode: 'GOLD' });
  });

  it('should promote a distribution partner on revenue alone', async () => {
    const { service, savedPartners } = buildService({
      partner: {
        id: 8,
        partnerType: PartnerTypeEnum.DISTRIBUTION,
        tierCode: 'BRONZE',
      },
      revenueVnd: '500000000',
      balanceVnd: '0',
      currentTier: { tierCode: 'BRONZE', minVolumeVnd: '0', isInternal: false },
    });

    await service.runMonthlyTierReview();

    expect(savedPartners[0]).toMatchObject({ tierCode: 'GOLD' });
  });

  it('should not let a deposit threshold of zero qualify everybody', async () => {
    // minDepositVnd 0 means "revenue only", not "any balance will do".
    const { service, savedPartners } = buildService({
      partner: {
        id: 8,
        partnerType: PartnerTypeEnum.DISTRIBUTION,
        tierCode: 'BRONZE',
      },
      revenueVnd: '0',
      balanceVnd: '0',
      tiers: [
        { tierCode: 'BRONZE', minVolumeVnd: '0', minDepositVnd: '0' },
        { tierCode: 'SILVER', minVolumeVnd: '1000000', minDepositVnd: '0' },
      ],
      currentTier: { tierCode: 'BRONZE', minVolumeVnd: '0', isInternal: false },
    });

    await service.runMonthlyTierReview();

    expect(savedPartners).toHaveLength(0);
  });

  it("should not ask a marketing partner's wallet about deposits", async () => {
    const { service } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: null },
    });

    await service.runMonthlyTierReview();

    const wallet = (
      service as unknown as {
        walletRepository: { findOne: jest.Mock };
      }
    ).walletRepository;
    expect(wallet.findOne).not.toHaveBeenCalled();
  });
});

describe('internal tiers in the monthly review (#074)', () => {
  it('should leave a partner on a negotiated tier where they are', async () => {
    // An internal tier is a private arrangement; the review undoing it would
    // quietly take back a rate somebody agreed to.
    const { service, savedPartners } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: 'VIP' },
      revenueVnd: '2000000',
      currentTier: { tierCode: 'VIP', minVolumeVnd: '0', isInternal: true },
    });

    await service.runMonthlyTierReview();

    expect(savedPartners).toHaveLength(0);
  });

  it('should not treat an internal tier as a rung on the public ladder', async () => {
    const { service } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: null },
    });

    await service.runMonthlyTierReview();

    const tierRepository = (
      service as unknown as {
        tierRepository: { find: jest.Mock };
      }
    ).tierRepository;
    expect(tierRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isInternal: false }),
      }),
    );
  });
});

describe('partnerUnitPriceVnd (#073)', () => {
  it('should add the markup to the cost, not take a discount off list', () => {
    // The brief's own worked example: 100.000đ at +10% is 110.000đ.
    expect(partnerUnitPriceVnd(100_000, 10)).toBe(110_000);
  });

  it('should charge cost exactly at a zero markup', () => {
    expect(partnerUnitPriceVnd(100_000, 0)).toBe(100_000);
  });

  it('should round to the dong', () => {
    // A price with a fraction of a dong on it cannot be charged.
    expect(partnerUnitPriceVnd(99_999, 12.5)).toBe(112_499);
  });

  it('should refuse to turn a bad figure into a negative price', () => {
    expect(partnerUnitPriceVnd(-5, 10)).toBe(0);
    expect(partnerUnitPriceVnd(100_000, Number.NaN)).toBe(100_000);
  });
});

describe('monthly tier cycle (vande #053)', () => {
  const kolOn = (tierCode: string, minVolumeVnd: string) => ({
    partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode },
    currentTier: { tierCode, minVolumeVnd, isInternal: false },
  });

  it("should count only the reviewed month's orders, cut on Hanoi midnight", async () => {
    const { service } = buildService(kolOn('BRONZE', '0'));

    await service.runMonthlyTierReview({ period: '2026-10' });

    const query = (service as unknown as { dataSource: { query: jest.Mock } })
      .dataSource.query;
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`AT TIME ZONE 'Asia/Ho_Chi_Minh'`);
    expect(sql).toContain(`INTERVAL '1 month'`);
    expect(params).toEqual([8, '2026-10-01']);
  });

  it('should move a partner down when last month fell short', async () => {
    // Gold last month, 2 triệu this one: Bạc for next month.
    const { service, savedPartners } = buildService({
      ...kolOn('GOLD', '500000000'),
      revenueVnd: '2000000',
    });

    await service.runMonthlyTierReview({ period: '2026-10' });

    expect(savedPartners[0]).toMatchObject({ tierCode: 'SILVER' });
    const evaluations = (
      service as unknown as { tierEvaluationRepository: { save: jest.Mock } }
    ).tierEvaluationRepository.save;
    expect(evaluations).toHaveBeenCalledWith(
      expect.objectContaining({
        period: '2026-10',
        result: 'demoted',
        tierBefore: 'GOLD',
        tierAfter: 'SILVER',
      }),
    );
  });

  it('should drop to the bottom tier after a month with no sales', async () => {
    const { service, savedPartners } = buildService({
      ...kolOn('SILVER', '1000000'),
      revenueVnd: '0',
    });

    await service.runMonthlyTierReview({ period: '2026-10' });

    expect(savedPartners[0]).toMatchObject({ tierCode: 'BRONZE' });
  });

  it('should not move down a partner who joined or was placed by hand during the month', async () => {
    const { service, savedPartners } = buildService({
      ...kolOn('GOLD', '500000000'),
      revenueVnd: '0',
      flags: { held: true },
    });

    await service.runMonthlyTierReview({ period: '2026-10' });

    expect(savedPartners).toHaveLength(0);
  });

  it('should still move such a partner up', async () => {
    const { service, savedPartners } = buildService({
      ...kolOn('BRONZE', '0'),
      revenueVnd: '2000000',
      flags: { held: true },
    });

    await service.runMonthlyTierReview({ period: '2026-10' });

    expect(savedPartners[0]).toMatchObject({ tierCode: 'SILVER' });
  });

  it('should not review the same month twice from the cron', async () => {
    const { service, savedPartners } = buildService({
      ...kolOn('BRONZE', '0'),
      revenueVnd: '2000000',
      flags: { reviewed: true },
    });

    await service.runMonthlyTierReview({ period: '2026-10' });

    expect(savedPartners).toHaveLength(0);
  });

  it('should review again when an admin asks for it', async () => {
    const { service, savedPartners } = buildService({
      ...kolOn('BRONZE', '0'),
      revenueVnd: '2000000',
      flags: { reviewed: true },
    });

    await service.runMonthlyTierReview({ period: '2026-10', rerun: true });

    expect(savedPartners[0]).toMatchObject({ tierCode: 'SILVER' });
  });

  it('should name the Vietnamese month, also across midnight UTC and the year end', () => {
    // 31/10 20:00 UTC is already 1/11 03:00 in Hanoi.
    const lateOct = new Date('2026-10-31T20:00:00Z');
    expect(vnMonth(0, lateOct)).toBe('2026-11');
    expect(vnMonth(-1, lateOct)).toBe('2026-10');
    expect(vnMonth(-1, new Date('2027-01-01T01:00:00Z'))).toBe('2026-12');
  });
});
