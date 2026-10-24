/**
 * How much commission an order earns (#060, test round 4).
 *
 * A partner's own discount code is paid for out of the partner's commission:
 * the budget is the tier rate on the order value BEFORE that discount, and the
 * customer's discount comes out of it — what the partner keeps plus what the
 * customer saved is always exactly the original commission, never more. It used
 * to be treated like the site-wide code (rate × value AFTER the discount), which
 * paid the partner the full rate on top of the discount they handed out.
 *
 * Any other code (the site's own) keeps that rule: rate × value after discount.
 */
export function partnerCommissionAmount(params: {
  /** Order value the commission is normally worked on — after discounts. */
  orderValueVnd: number;
  commissionPercent: number;
  /** Discount taken by the partner's OWN code on this order, if one was used. */
  ownCouponDiscountVnd?: number | null;
}): { commissionVnd: number; effectivePercent: number } {
  const rate = Math.max(0, params.commissionPercent);
  const value = Math.max(0, params.orderValueVnd);
  const ownDiscount = Math.max(0, params.ownCouponDiscountVnd ?? 0);

  if (ownDiscount <= 0) {
    return {
      commissionVnd: Math.round((value * rate) / 100),
      effectivePercent: rate,
    };
  }

  const beforeDiscount = value + ownDiscount;
  const budget = (beforeDiscount * rate) / 100;
  const commissionVnd = Math.max(0, Math.round(budget - ownDiscount));
  // Four decimals (vande #007): at two, 384 200 / 2 121 000 was kept as
  // 18.11% and 18.11% x 2 121 000 = 384 107 — not the commission paid, which
  // a partner checking the sum will notice.
  const effectivePercent =
    beforeDiscount > 0
      ? Math.round((commissionVnd * 1_000_000) / beforeDiscount) / 10_000
      : 0;
  return { commissionVnd, effectivePercent };
}
