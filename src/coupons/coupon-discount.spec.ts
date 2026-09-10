import {
  computeCouponDiscount,
  effectiveDiscountPercent,
} from './coupon-discount';

/**
 * Flat-amount codes and capped percentages (#082).
 *
 * The same rule runs in three places — coupon validation, order totals and the
 * storefront's cart preview. If they disagree, the customer sees one price and
 * is charged another, so the arithmetic is pinned down here.
 */
describe('computeCouponDiscount', () => {
  it('should take a straight percentage when there is no ceiling', () => {
    expect(
      computeCouponDiscount(
        { discountType: 'percent', discountPercent: 15 },
        1_000_000,
      ),
    ).toBe(150_000);
  });

  it('should stop at the ceiling on a large order', () => {
    // "15% off, up to 50k": 15% of 5M is 750k, but the code caps at 50k.
    expect(
      computeCouponDiscount(
        {
          discountType: 'percent',
          discountPercent: 15,
          maxDiscountAmount: 50_000,
        },
        5_000_000,
      ),
    ).toBe(50_000);
  });

  it('should stay below the ceiling on a small order', () => {
    expect(
      computeCouponDiscount(
        {
          discountType: 'percent',
          discountPercent: 15,
          maxDiscountAmount: 50_000,
        },
        200_000,
      ),
    ).toBe(30_000);
  });

  it('should take a flat amount when the code is a fixed one', () => {
    expect(
      computeCouponDiscount(
        { discountType: 'fixed', discountAmount: 50_000, discountPercent: 0 },
        300_000,
      ),
    ).toBe(50_000);
  });

  it('should never discount more than the order itself', () => {
    // A 100k code on a 60k order takes 60k, not 100k — the total cannot go
    // negative.
    expect(
      computeCouponDiscount(
        { discountType: 'fixed', discountAmount: 100_000 },
        60_000,
      ),
    ).toBe(60_000);
    expect(
      computeCouponDiscount(
        { discountType: 'percent', discountPercent: 150 },
        60_000,
      ),
    ).toBe(60_000);
  });

  it('should ignore a ceiling on a flat-amount code', () => {
    expect(
      computeCouponDiscount(
        {
          discountType: 'fixed',
          discountAmount: 50_000,
          maxDiscountAmount: 10_000,
        },
        300_000,
      ),
    ).toBe(50_000);
  });

  it('should treat a missing type as a percentage, like every existing code', () => {
    expect(computeCouponDiscount({ discountPercent: 10 }, 500_000)).toBe(
      50_000,
    );
  });

  it('should give nothing away on an empty or nonsense order', () => {
    expect(computeCouponDiscount({ discountPercent: 10 }, 0)).toBe(0);
    expect(computeCouponDiscount({ discountPercent: 10 }, -100)).toBe(0);
    expect(computeCouponDiscount({ discountPercent: 0 }, 500_000)).toBe(0);
    expect(
      computeCouponDiscount({ discountType: 'fixed', discountAmount: 0 }, 5000),
    ).toBe(0);
  });

  it('should treat a zero or missing ceiling as uncapped', () => {
    expect(
      computeCouponDiscount(
        { discountPercent: 15, maxDiscountAmount: 0 },
        1_000_000,
      ),
    ).toBe(150_000);
    expect(
      computeCouponDiscount(
        { discountPercent: 15, maxDiscountAmount: null },
        1_000_000,
      ),
    ).toBe(150_000);
  });
});

describe('effectiveDiscountPercent', () => {
  it('should report the share actually taken off, not the configured one', () => {
    // The USD side of an order is derived from this: a code configured at 15%
    // but capped at 50k only takes 1% off a 5M order.
    const discount = computeCouponDiscount(
      { discountPercent: 15, maxDiscountAmount: 50_000 },
      5_000_000,
    );

    expect(effectiveDiscountPercent(discount, 5_000_000)).toBe(1);
  });

  it('should match the configured percent when nothing caps it', () => {
    expect(effectiveDiscountPercent(150_000, 1_000_000)).toBe(15);
  });

  it('should not divide by zero', () => {
    expect(effectiveDiscountPercent(50_000, 0)).toBe(0);
  });
});
