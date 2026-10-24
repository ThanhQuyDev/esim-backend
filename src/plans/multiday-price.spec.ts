import { multidayRetailVnd } from './multiday-price';
import {
  getDiscountedVndPrice,
  getPlanUsdPrice,
} from '../orders/orders.service';

/**
 * Giá gói theo ngày mua nhiều ngày (vande #014): lời tính 1 lần trên tổng giá
 * vốn, không nhân theo số ngày. Bảng bậc lợi nhuận là bảng trên prod 25/10.
 */
const TIERS = [
  { minVnd: 0, maxVnd: 49_999, percentage: 0, fixedAmountVnd: 50_000 },
  { minVnd: 50_000, maxVnd: 99_999, percentage: 0, fixedAmountVnd: 80_000 },
  { minVnd: 100_000, maxVnd: 999_999, percentage: 70, fixedAmountVnd: 0 },
  { minVnd: 1_000_000, maxVnd: 2_999_999, percentage: 65, fixedAmountVnd: 0 },
];
// eSIM 8948010010047313209: Kazakhstan 1GB/day, cost 18 000/day, 68 000 a day.
const KZ = {
  isAbleMultidate: true,
  vndCostPrice: 18_000,
  vndPrice: 68_000,
  usdPrice: 2.64,
  discount: 0,
};

describe('Giá gói nhiều ngày (vande #014)', () => {
  it('should keep the 1-day price', () => {
    expect(multidayRetailVnd(KZ, 1, TIERS)).toBe(68_000);
  });

  it('should charge the margin once on the whole cost', () => {
    // 30 days: 540 000 cost → +70% = 918 000 (was 68 000 × 30 = 2 040 000).
    expect(multidayRetailVnd(KZ, 30, TIERS)).toBe(918_000);
    // 2 days: 36 000 cost → +50 000 = 86 000 (was 136 000).
    expect(multidayRetailVnd(KZ, 2, TIERS)).toBe(86_000);
    // 3 days: 54 000 cost → +80 000 = 134 000 (was 204 000).
    expect(multidayRetailVnd(KZ, 3, TIERS)).toBe(134_000);
  });

  it('should leave fixed plans and plans without tiers as before', () => {
    expect(
      multidayRetailVnd({ ...KZ, isAbleMultidate: false }, 30, TIERS),
    ).toBe(68_000);
    expect(multidayRetailVnd(KZ, 30, null)).toBe(2_040_000);
  });

  it('should price the order line and its dollars the same way', () => {
    const plan = KZ as never;
    expect(getDiscountedVndPrice(plan, 30, TIERS)).toBe(918_000);
    expect(getPlanUsdPrice(plan, 30, TIERS)).toBeCloseTo((2.64 * 918) / 68, 2);
    expect(
      getDiscountedVndPrice({ ...KZ, discount: 10 } as never, 30, TIERS),
    ).toBe(826_000);
  });
});
