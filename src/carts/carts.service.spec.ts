import { CartsService } from './carts.service';
import { getDiscountedVndPrice } from '../orders/orders.service';

/** Bảng bậc lợi nhuận trên beta 05/11. */
const TIERS = [
  { minVnd: 0, maxVnd: 49_999, percentage: 0, fixedAmountVnd: 50_000 },
  { minVnd: 50_000, maxVnd: 99_999, percentage: 0, fixedAmountVnd: 80_000 },
  { minVnd: 100_000, maxVnd: 999_999, percentage: 70, fixedAmountVnd: 0 },
];
// PVG1G9ZU2, eSIM Access China 1GB/day: $0.8 a day, shown as 21 000 đ cost.
const CHINA = {
  isAbleMultidate: true,
  vndCostPrice: 21_000,
  vndCostExact: 20_615.2522,
  vndPrice: 71_000,
  discount: 0,
};

function serviceWith(items: unknown[]) {
  return new CartsService(
    { findByUserId: jest.fn().mockResolvedValue(items) } as never,
    { marginTiers: jest.fn().mockResolvedValue(TIERS) } as never,
  );
}

describe('Giá trong giỏ hàng (vande-0411 #001)', () => {
  it('should price 14 days of a day pass on its real cost, not 71 000 × 14', async () => {
    const [line] = await serviceWith([
      { id: 1, plan: CHINA, periodNum: 14, quantity: 1 },
    ]).getCart(1);

    expect(line.unitVndPrice).toBe(491_000);
    expect(line.unitOriginalVndPrice).toBe(491_000);
  });

  it('should charge at checkout what the cart shows', async () => {
    const [line] = await serviceWith([
      { id: 1, plan: { ...CHINA, discount: 10 }, periodNum: 14, quantity: 1 },
    ]).getCart(1);

    expect(line.unitVndPrice).toBe(
      getDiscountedVndPrice({ ...CHINA, discount: 10 } as never, 14, TIERS),
    );
    expect(line.unitVndPrice).toBe(442_000);
    expect(line.unitOriginalVndPrice).toBe(491_000);
  });

  it('should leave a fixed plan at its own price whatever the days', async () => {
    const [line] = await serviceWith([
      {
        id: 1,
        plan: { isAbleMultidate: false, vndPrice: 120_000, discount: 0 },
        periodNum: null,
        quantity: 2,
      },
    ]).getCart(1);

    expect(line.unitVndPrice).toBe(120_000);
  });

  it('should fall back to the displayed cost when the real one is unknown', async () => {
    const [line] = await serviceWith([
      {
        id: 1,
        plan: { ...CHINA, vndCostExact: null },
        periodNum: 14,
        quantity: 1,
      },
    ]).getCart(1);

    expect(line.unitVndPrice).toBe(500_000);
  });
});
