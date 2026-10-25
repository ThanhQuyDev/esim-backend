import { TierBenefits } from './tier.constants';
import { MembershipTierCode, TierSourceEnum } from './tier.enum';
import { baseTier, currentTierBenefits, tierOrder } from './tier.registry';

export type TierSummary = {
  automaticTier: MembershipTierCode;
  membershipTier: MembershipTierCode;
  tierSource: TierSourceEnum;
  benefits: TierBenefits;
  nextTier: MembershipTierCode | null;
  nextTierThresholdVnd: number | null;
  progressPercent: number;
};

export function resolveAutomaticTier(
  lifetimeSpendVnd: number,
): MembershipTierCode {
  const spend = Math.max(0, Number(lifetimeSpendVnd) || 0);
  const order = tierOrder();

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const tier = order[index];
    if (spend >= currentTierBenefits()[tier].minimumSpendVnd) return tier;
  }

  return baseTier();
}

/** What a tier pays; a tier since deleted pays what the first tier pays. */
export function getTierBenefits(tier: MembershipTierCode): TierBenefits {
  const row = currentTierBenefits()[tier] ?? currentTierBenefits()[baseTier()];
  return {
    minimumSpendVnd: row.minimumSpendVnd,
    cashbackPercent: row.cashbackPercent,
    referralRewardVnd: row.referralRewardVnd,
  };
}

export function resolveTierSummary(
  lifetimeSpendVnd: number,
  tierOverride?: MembershipTierCode | null,
): TierSummary {
  const spend = Math.max(0, Number(lifetimeSpendVnd) || 0);
  const automaticTier = resolveAutomaticTier(spend);
  // An override to a tier that has since been deleted no longer applies.
  const override =
    tierOverride && currentTierBenefits()[tierOverride] ? tierOverride : null;
  const membershipTier = override ?? automaticTier;
  const order = tierOrder();
  const currentAutomaticIndex = order.indexOf(automaticTier);
  const nextTier = order[currentAutomaticIndex + 1] ?? null;
  const table = currentTierBenefits();
  const currentThreshold = table[automaticTier].minimumSpendVnd;
  const nextThreshold = nextTier ? table[nextTier].minimumSpendVnd : null;
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
    tierSource: override ? TierSourceEnum.OVERRIDE : TierSourceEnum.AUTOMATIC,
    benefits: getTierBenefits(membershipTier),
    nextTier,
    nextTierThresholdVnd: nextThreshold,
    progressPercent: Math.round(progressPercent),
  };
}
