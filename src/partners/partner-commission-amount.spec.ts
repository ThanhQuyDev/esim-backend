import { partnerCommissionAmount } from './partner-commission-amount';

/**
 * #060 (test round 4) — a partner's own discount code comes out of their
 * commission; the site-wide code does not.
 */
describe('partnerCommissionAmount (#060)', () => {
  it('should pay the rate on the value after a site-wide discount', () => {
    // 100.000đ order, site code took 10.000đ: 7% of 90.000đ.
    expect(
      partnerCommissionAmount({ orderValueVnd: 90_000, commissionPercent: 7 }),
    ).toEqual({ commissionVnd: 6_300, effectivePercent: 7 });
  });

  it("should take the partner's own discount out of their commission", () => {
    // 100.000đ order, partner's 5% code took 5.000đ: budget 7.000đ, partner
    // keeps 2.000đ — 2% of the original value. 2.000 + 5.000 = 7.000.
    expect(
      partnerCommissionAmount({
        orderValueVnd: 95_000,
        commissionPercent: 7,
        ownCouponDiscountVnd: 5_000,
      }),
    ).toEqual({ commissionVnd: 2_000, effectivePercent: 2 });
  });

  it('should keep more when the discount hit its cap', () => {
    // 2.000.000đ order, 5% code capped at 50.000đ: budget 140.000đ, partner
    // keeps 90.000đ.
    expect(
      partnerCommissionAmount({
        orderValueVnd: 1_950_000,
        commissionPercent: 7,
        ownCouponDiscountVnd: 50_000,
      }).commissionVnd,
    ).toBe(90_000);
  });

  it('should never go below zero', () => {
    expect(
      partnerCommissionAmount({
        orderValueVnd: 90_000,
        commissionPercent: 7,
        ownCouponDiscountVnd: 10_000,
      }).commissionVnd,
    ).toBe(0);
  });
});
