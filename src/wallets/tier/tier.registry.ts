import { TIER_BENEFITS, TIER_ORDER, TierBenefits } from './tier.constants';
import { MembershipTierEnum } from './tier.enum';

export type TierBenefitsTable = Record<MembershipTierEnum, TierBenefits>;

/**
 * The tier table the whole backend pays out from (#024).
 *
 * Admins edit the ladder in the CMS and it is stored in `membership_tier_config`,
 * but the resolver is called synchronously — from the user mapper, the wallet
 * summary and the order cashback snapshot — so the saved table is held here in
 * memory. `TIER_BENEFITS` is only the starting point until the database copy
 * has loaded.
 */
let current: TierBenefitsTable = cloneTable(TIER_BENEFITS);

function cloneTable(table: TierBenefitsTable): TierBenefitsTable {
  return TIER_ORDER.reduce((copy, tier) => {
    copy[tier] = { ...table[tier] };
    return copy;
  }, {} as TierBenefitsTable);
}

export function currentTierBenefits(): Readonly<TierBenefitsTable> {
  return current;
}

export function applyTierBenefits(table: TierBenefitsTable): void {
  current = cloneTable(table);
}

export type TierLadderProblem = {
  tier: MembershipTierEnum;
  field: keyof TierBenefits;
  code: string;
};

/**
 * Why this ladder cannot be used, or null when it can.
 *
 * The automatic tier walks the thresholds from the top down, so they must rise
 * strictly and the first tier must start at 0đ — otherwise a new customer would
 * belong to no tier at all.
 */
export function validateTierLadder(
  table: TierBenefitsTable,
): TierLadderProblem | null {
  for (let index = 0; index < TIER_ORDER.length; index += 1) {
    const tier = TIER_ORDER[index];
    const benefits = table[tier];

    if (
      !Number.isInteger(benefits.minimumSpendVnd) ||
      benefits.minimumSpendVnd < 0
    ) {
      return { tier, field: 'minimumSpendVnd', code: 'invalidMinimumSpend' };
    }
    if (
      !Number.isFinite(benefits.cashbackPercent) ||
      benefits.cashbackPercent < 0 ||
      benefits.cashbackPercent > 100
    ) {
      return { tier, field: 'cashbackPercent', code: 'invalidCashbackPercent' };
    }
    if (
      !Number.isInteger(benefits.referralRewardVnd) ||
      benefits.referralRewardVnd < 0
    ) {
      return {
        tier,
        field: 'referralRewardVnd',
        code: 'invalidReferralReward',
      };
    }

    if (index === 0) {
      if (benefits.minimumSpendVnd !== 0) {
        return {
          tier,
          field: 'minimumSpendVnd',
          code: 'lowestTierMustStartAtZero',
        };
      }
    } else if (
      benefits.minimumSpendVnd <= table[TIER_ORDER[index - 1]].minimumSpendVnd
    ) {
      return {
        tier,
        field: 'minimumSpendVnd',
        code: 'minimumSpendNotAscending',
      };
    }
  }

  return null;
}
