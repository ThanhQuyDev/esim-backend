import { TIER_BENEFITS, TIER_ORDER, TierBenefits } from './tier.constants';
import { MembershipTierEnum, TierSourceEnum } from './tier.enum';

export type TierSummary = {
  automaticTier: MembershipTierEnum;
  membershipTier: MembershipTierEnum;
  tierSource: TierSourceEnum;
  benefits: TierBenefits;
  nextTier: MembershipTierEnum | null;
  nextTierThresholdVnd: number | null;
  progressPercent: number;
};

export function resolveAutomaticTier(
  lifetimeSpendVnd: number,
): MembershipTierEnum {
  const spend = Math.max(0, Number(lifetimeSpendVnd) || 0);

  for (let index = TIER_ORDER.length - 1; index >= 0; index -= 1) {
    const tier = TIER_ORDER[index];
    if (spend >= TIER_BENEFITS[tier].minimumSpendVnd) return tier;
  }

  return MembershipTierEnum.TRAVELER;
}

export function getTierBenefits(tier: MembershipTierEnum): TierBenefits {
  return TIER_BENEFITS[tier];
}

export function resolveTierSummary(
  lifetimeSpendVnd: number,
  tierOverride?: MembershipTierEnum | null,
): TierSummary {
  const spend = Math.max(0, Number(lifetimeSpendVnd) || 0);
  const automaticTier = resolveAutomaticTier(spend);
  const membershipTier = tierOverride ?? automaticTier;
  const currentAutomaticIndex = TIER_ORDER.indexOf(automaticTier);
  const nextTier = TIER_ORDER[currentAutomaticIndex + 1] ?? null;
  const currentThreshold = TIER_BENEFITS[automaticTier].minimumSpendVnd;
  const nextThreshold = nextTier
    ? TIER_BENEFITS[nextTier].minimumSpendVnd
    : null;
  const progressPercent = nextThreshold
    ? Math.min(
        100,
        Math.max(
          0,
          ((spend - currentThreshold) / (nextThreshold - currentThreshold)) *
            100,
        ),
      )
    : 100;

  return {
    automaticTier,
    membershipTier,
    tierSource: tierOverride
      ? TierSourceEnum.OVERRIDE
      : TierSourceEnum.AUTOMATIC,
    benefits: getTierBenefits(membershipTier),
    nextTier,
    nextTierThresholdVnd: nextThreshold,
    progressPercent: Math.round(progressPercent),
  };
}
