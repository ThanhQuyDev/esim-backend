import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * A partner on an internal tier is outside the revenue ladder (doitac-1410
 * #024): no "Còn 0 ₫ để lên hạng Bạc", and only their own tier is listed.
 */
const LADDER = [
  {
    tierCode: 'DONG',
    tierName: 'Đồng',
    minVolumeVnd: 0,
    sortOrder: 1,
    isInternal: false,
  },
  {
    tierCode: 'BAC',
    tierName: 'Bạc',
    minVolumeVnd: 5_000_000,
    sortOrder: 2,
    isInternal: false,
  },
];
const VIP = {
  tierCode: 'CHIENLUOC',
  tierName: 'Chiến lược',
  minVolumeVnd: 0,
  sortOrder: 9,
  isInternal: true,
  costMarkupPercent: 3,
};

function buildService(tierCode: string) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const rows = [
    [{ revenue30: 0, orders30: 0, revenueTotal: 0, ordersTotal: 0 }],
    [{ commission30: 0, commissionTotal: 0, commissionPending: 0 }],
    [{ clicks30: 0, clicksTotal: 0 }],
    [{ newCustomers: 0, returningCustomers: 0 }],
    [{ commissionThis: 0, commissionPrev: 0 }],
  ];
  let call = 0;
  const all = [...LADDER, VIP];
  Object.assign(service, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 5,
      partnerType: PartnerTypeEnum.KOL,
      tierCode,
    }),
    dataSource: { query: jest.fn(() => Promise.resolve(rows[call++])) },
    getWalletSummaryForPartner: jest.fn().mockResolvedValue({
      balanceVnd: 0,
      availableBalanceVnd: 0,
      carriedDebtVnd: 0,
    }),
    tierRepository: {
      find: jest.fn(({ where }: { where: { isInternal?: boolean } }) =>
        Promise.resolve(
          where.isInternal === false
            ? LADDER.map((t) => ({ ...t }))
            : all.map((t) => ({ ...t })),
        ),
      ),
      findOne: jest.fn(({ where }: { where: { tierCode: string } }) =>
        Promise.resolve(all.find((t) => t.tierCode === where.tierCode) ?? null),
      ),
    },
  });
  return service;
}

describe('PartnersService — internal tier (doitac-1410 #024)', () => {
  it('should give an internal-tier partner no next rung on the overview', async () => {
    const summary = await buildService('CHIENLUOC').getMySummary(5);

    expect(summary.tier.isInternal).toBe(true);
    expect(summary.tier.next).toBeNull();
    expect(summary.tier.toNextTierVnd).toBe(0);
    expect(summary.tier.current).toMatchObject({ tierName: 'Chiến lược' });
  });

  it('should still show the ladder to a partner on a public tier', async () => {
    const summary = await buildService('DONG').getMySummary(5);

    expect(summary.tier.isInternal).toBe(false);
    expect(summary.tier.next).toMatchObject({ tierCode: 'BAC' });
  });

  it('should list only their own tier to an internal-tier partner', async () => {
    const tiers = await buildService('CHIENLUOC').getMyTiers(5);

    expect(tiers.map((t) => t.tierCode)).toEqual(['CHIENLUOC']);
    expect(tiers[0]).not.toHaveProperty('costMarkupPercent');
  });

  it('should list the public ladder to everyone else', async () => {
    const tiers = await buildService('DONG').getMyTiers(5);

    expect(tiers.map((t) => t.tierCode)).toEqual(['DONG', 'BAC']);
  });
});
