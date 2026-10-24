/**
 * Price of a day pass bought for several days (vande #014).
 *
 * eSIM Access sells a day pass for 1–365 days at the per-day cost times the
 * days. We priced it as (1-day retail) × days, which repeats the margin every
 * day: on a fixed-amount tier (+N đồng per sale) a 30-day pass carried the
 * margin 30 times. The margin now applies once, to the whole cost:
 *
 *     retail(days) = tier( per-day cost × days ), rounded to 1 000 đ
 *
 * — the same tier rule and rounding as the 1-day price
 * (`PlanRepository.recalculatePricesByTiers`, `calculateRetailVndFromCostUsd`),
 * so 1 day still costs exactly `vndPrice`. The storefront mirrors this in
 * `lib/multiday-price.ts` so the page shows what checkout charges.
 */
export interface MarginTier {
  minVnd: number;
  maxVnd: number;
  percentage: number;
  fixedAmountVnd?: number | null;
}

export interface MultidayPlan {
  isAbleMultidate?: boolean | null;
  /** Per-day cost in đồng, supplier surcharge included. */
  vndCostPrice?: number | string | null;
  /** 1-day retail in đồng. */
  vndPrice?: number | string | null;
}

/** The tier rule on a cost in đồng; no matching tier passes the cost through. */
export function retailVndForCost(costVnd: number, tiers: MarginTier[]): number {
  let retail = costVnd;
  for (const tier of tiers) {
    if (costVnd >= Number(tier.minVnd) && costVnd <= Number(tier.maxVnd)) {
      const fixed = Number(tier.fixedAmountVnd) || 0;
      retail =
        fixed > 0
          ? costVnd + fixed
          : costVnd * (1 + Number(tier.percentage) / 100);
      break;
    }
  }
  return Math.round(retail / 1000) * 1000;
}

/**
 * Retail in đồng for `days` of a plan, before any plan discount. Plans that are
 * not day passes, one day, or a plan without a known cost keep the plain
 * per-day price × days.
 */
export function multidayRetailVnd(
  plan: MultidayPlan,
  days: number,
  tiers: MarginTier[] | null | undefined,
): number {
  const perDay = Number(plan.vndPrice ?? 0) || 0;
  const n = plan.isAbleMultidate ? Math.max(1, Math.round(days || 1)) : 1;
  if (n === 1) return perDay;
  const cost = Number(plan.vndCostPrice ?? 0) || 0;
  if (!tiers?.length || !(cost > 0)) return perDay * n;
  return retailVndForCost(cost * n, tiers);
}
