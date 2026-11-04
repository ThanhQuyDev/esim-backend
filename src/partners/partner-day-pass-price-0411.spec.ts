import { PartnersService } from './partners.service';

/**
 * vande-0411 #002 — agent price of an eSIM Access day pass.
 *
 * Anh Thọ's example: PVG1G9ZU2 costs 0.8$ a day, shown as 21 000 đ. For a partner
 * whose tier adds 50 %, 14 days are (20 613 × 14) × 1.5 = 432 869 đ → 433 000 đ.
 * The old way, 71 000 × 14 × 1.5, came to 1 491 000 đ.
 */
const TIERS = [
  { minVnd: 100_000, maxVnd: 999_999, percentage: 70, fixedAmountVnd: 0 },
];

function service(row: Record<string, unknown>, markup: number) {
  const s = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(s, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 4,
      partnerType: 'distribution',
      status: 'active',
      tierCode: 'GOLD',
    }),
    purchaseMarkupPercentFor: jest.fn().mockResolvedValue(markup),
    plansService: { marginTiers: jest.fn().mockResolvedValue(TIERS) },
    dataSource: { query: jest.fn().mockResolvedValue([row]) },
    getOrCreateWallet: jest
      .fn()
      .mockResolvedValue({ status: 'active', balanceVnd: '5000000' }),
  });
  return s;
}

const DAY_PASS = {
  isAbleMultidate: true,
  vndPrice: 71_000,
  vndCostPrice: 21_000,
  vndCostExact: 20_613,
};

describe('Giá đại lý gói theo ngày (vande-0411 #002)', () => {
  it('should price 14 days on the real cost plus the tier', async () => {
    const quote = await service(DAY_PASS, 50).quotePurchase(4, 1, 1, 14);

    expect(quote.unitPriceVnd).toBe(433_000);
  });

  it('should read the real cost from the database', async () => {
    const s = service(DAY_PASS, 50);
    await s.quotePurchase(4, 1, 1, 14);

    const sql = (s as never as { dataSource: { query: jest.Mock } }).dataSource
      .query.mock.calls[0][0];
    expect(sql).toContain('"vndCostExact"');
  });

  it('should multiply by the eSIMs, not again by the days', async () => {
    const quote = await service(DAY_PASS, 50).quotePurchase(4, 1, 3, 14);

    expect(quote.totalVnd).toBe(1_299_000);
  });

  it('should never go above what the web sells those days for', async () => {
    // Web: 20 613 × 14 × 1.7 = 490 589 → 491 000 đ; the tier would come to 577 000 đ.
    const quote = await service(DAY_PASS, 100).quotePurchase(4, 1, 1, 14);

    expect(quote.unitPriceVnd).toBe(491_000);
  });

  it('should fall back to the displayed cost while the real one is unknown', async () => {
    const quote = await service(
      { ...DAY_PASS, vndCostExact: null },
      50,
    ).quotePurchase(4, 1, 1, 14);

    expect(quote.unitPriceVnd).toBe(441_000);
  });
});
