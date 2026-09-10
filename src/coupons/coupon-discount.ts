/**
 * What a coupon actually takes off an order (#082).
 *
 * Codes used to be percentage-only and uncapped, so "15% off" on a 5 million
 * dong order gave away 750k. Two things were missing: a flat-amount code
 * ("50k off"), and a ceiling on a percentage one ("15%, up to 50k").
 *
 * The rule lives here, on its own, because three places have to agree on it —
 * validation, order totals, and the storefront's cart preview. When they
 * disagree, the customer is shown a price the cart then refuses to honour.
 */

export type CouponDiscountType = 'percent' | 'fixed';

export const COUPON_DISCOUNT_TYPES: CouponDiscountType[] = ['percent', 'fixed'];

export interface CouponDiscountRule {
  discountType?: CouponDiscountType | null;
  /** Percentage off, when the type is `percent`. */
  discountPercent?: number | null;
  /** Flat amount off, when the type is `fixed`. */
  discountAmount?: number | null;
  /** Ceiling for a percentage code; null means uncapped. */
  maxDiscountAmount?: number | null;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Round to cents, so the same figure comes out of every caller. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The discount for an order, in the order's own currency.
 *
 * Never more than the order itself: a 100k flat code on a 60k order takes 60k,
 * not 100k, which would otherwise leave a negative total.
 */
export function computeCouponDiscount(
  coupon: CouponDiscountRule,
  orderAmount: number,
): number {
  const total = toNumber(orderAmount);
  if (total <= 0) return 0;

  if (coupon.discountType === 'fixed') {
    const flat = toNumber(coupon.discountAmount);
    return round(Math.max(0, Math.min(flat, total)));
  }

  const percent = toNumber(coupon.discountPercent);
  if (percent <= 0) return 0;

  let discount = (total * percent) / 100;

  const cap = coupon.maxDiscountAmount;
  if (cap !== null && cap !== undefined && toNumber(cap) > 0) {
    discount = Math.min(discount, toNumber(cap));
  }

  return round(Math.max(0, Math.min(discount, total)));
}

/**
 * The share of the order this discount represents.
 *
 * Order totals are also kept in USD, and that figure used to be derived from
 * the coupon's configured percentage — which stops being the real discount as
 * soon as a cap or a flat amount is involved. Deriving it from the money
 * actually taken off keeps the two currencies telling the same story.
 */
export function effectiveDiscountPercent(
  discount: number,
  orderAmount: number,
): number {
  const total = toNumber(orderAmount);
  if (total <= 0) return 0;
  return round((toNumber(discount) / total) * 100);
}
