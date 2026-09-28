import { PartnersService, partnerUnitPriceVnd } from './partners.service';
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
}: {
  partner: Record<string, unknown>;
  revenueVnd?: string;
  balanceVnd?: string;
  tiers?: Record<string, unknown>[];
  currentTier?: Record<string, unknown> | null;
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
      query: jest.fn().mockResolvedValue([{ revenueVnd, validOrders: '4' }]),
    },
  });

  return { service, savedPartners };
}

describe('PartnersService.runWeeklyTierReview (#072, #073)', () => {
  it('should promote a marketing partner on the orders credited to them', async () => {
    const { service, savedPartners } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: 'BRONZE' },
      revenueVnd: '2000000',
      currentTier: { tierCode: 'BRONZE', minVolumeVnd: '0', isInternal: false },
    });

    await service.runWeeklyTierReview();

    expect(savedPartners[0]).toMatchObject({ tierCode: 'SILVER' });
  });

  it("should read a marketing partner's revenue off the orders attributed to them", async () => {
    const { service } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: null },
    });

    await service.runWeeklyTierReview();

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

    await service.runWeeklyTierReview();

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

    await service.runWeeklyTierReview();

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

    await service.runWeeklyTierReview();

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

    await service.runWeeklyTierReview();

    expect(savedPartners).toHaveLength(0);
  });

  it("should not ask a marketing partner's wallet about deposits", async () => {
    const { service } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: null },
    });

    await service.runWeeklyTierReview();

    const wallet = (
      service as unknown as {
        walletRepository: { findOne: jest.Mock };
      }
    ).walletRepository;
    expect(wallet.findOne).not.toHaveBeenCalled();
  });
});

describe('internal tiers in the weekly review (#074)', () => {
  it('should leave a partner on a negotiated tier where they are', async () => {
    // An internal tier is a private arrangement; the review undoing it would
    // quietly take back a rate somebody agreed to.
    const { service, savedPartners } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: 'VIP' },
      revenueVnd: '2000000',
      currentTier: { tierCode: 'VIP', minVolumeVnd: '0', isInternal: true },
    });

    await service.runWeeklyTierReview();

    expect(savedPartners).toHaveLength(0);
  });

  it('should not treat an internal tier as a rung on the public ladder', async () => {
    const { service } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL, tierCode: null },
    });

    await service.runWeeklyTierReview();

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
