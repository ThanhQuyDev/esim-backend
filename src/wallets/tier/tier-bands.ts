import { TIER_ORDER } from './tier.constants';
import { MembershipTierEnum } from './tier.enum';
import { currentTierBenefits } from './tier.registry';

/**
 * The lifetime-spend range that earns one tier.
 *
 * `ceilingVnd` is inclusive and `null` for the top tier, which has none.
 */
export type TierBand = {
  tier: MembershipTierEnum;
  floorVnd: number;
  ceilingVnd: number | null;
};

/**
 * Spend bands for the requested tiers, lowest first (#037, #057).
 *
 * The effective tier is `tierOverride ?? automaticTier(lifetimeSpendVnd)` and is
 * never stored, so anything that filters on it has to translate the tier back
 * into a spend range. Two screens now do — the customer list and the eXu wallet
 * list — in two different query dialects, so the ranges themselves live here
 * rather than being derived twice.
 *
 * The floors come from the live registry, so a threshold an admin edits in
 * `membership_tier_config` moves every filter with it. `lifetimeSpendVnd` is
 * decimal(14,0) — whole đồng — so a band ends one đồng short of the next floor,
 * which is what keeps adjacent bands from overlapping on a round number.
 */
export function tierBands(tiers: MembershipTierEnum[]): TierBand[] {
  const wanted = TIER_ORDER.filter((tier) => tiers.includes(tier));
  if (!wanted.length) return [];

  const benefits = currentTierBenefits();

  return wanted.map((tier) => {
    const nextTier = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1];
    return {
      tier,
      floorVnd: benefits[tier].minimumSpendVnd,
      ceilingVnd: nextTier ? benefits[nextTier].minimumSpendVnd - 1 : null,
    };
  });
}
