import { TIER_BENEFITS } from './tier.constants';
import { MembershipTierEnum } from './tier.enum';
import {
  applyTierBenefits,
  TierBenefitsTable,
  validateTierLadder,
} from './tier.registry';
import { resolveAutomaticTier, resolveTierSummary } from './tier.resolver';

/**
 * Tiers edited in the CMS (#024) must reach every payout that reads the
 * resolver, and a ladder that would leave customers without a tier must never
 * be accepted.
 */

function ladder(
  patch: Partial<
    Record<MembershipTierEnum, Partial<TierBenefitsTable['gold']>>
  >,
): TierBenefitsTable {
  const table = JSON.parse(JSON.stringify(TIER_BENEFITS)) as TierBenefitsTable;
  for (const [tier, values] of Object.entries(patch)) {
    Object.assign(table[tier as MembershipTierEnum], values);
  }
  return table;
}

describe('tier registry', () => {
  afterEach(() => applyTierBenefits(TIER_BENEFITS));

  it('should pay out from an edited ladder once applied', () => {
    applyTierBenefits(
      ladder({
        [MembershipTierEnum.SILVER]: {
          minimumSpendVnd: 2_000_000,
          cashbackPercent: 3.5,
          referralRewardVnd: 13_000,
        },
      }),
    );

    expect(resolveAutomaticTier(1_500_000)).toBe(MembershipTierEnum.TRAVELER);
    const summary = resolveTierSummary(2_000_000);
    expect(summary.membershipTier).toBe(MembershipTierEnum.SILVER);
    expect(summary.benefits).toEqual({
      minimumSpendVnd: 2_000_000,
      cashbackPercent: 3.5,
      referralRewardVnd: 13_000,
    });
  });

  it('should not let a caller mutate the live table through a summary', () => {
    resolveTierSummary(0).benefits.cashbackPercent = 99;

    expect(resolveTierSummary(0).benefits.cashbackPercent).toBe(2);
  });

  it('should accept the default ladder', () => {
    expect(validateTierLadder(TIER_BENEFITS)).toBeNull();
  });

  it.each([
    [
      'the lowest tier not starting at 0',
      ladder({ [MembershipTierEnum.TRAVELER]: { minimumSpendVnd: 100 } }),
      'lowestTierMustStartAtZero',
    ],
    [
      'a threshold equal to the tier below',
      ladder({ [MembershipTierEnum.GOLD]: { minimumSpendVnd: 1_000_000 } }),
      'minimumSpendNotAscending',
    ],
    [
      'a threshold above the tier above',
      ladder({ [MembershipTierEnum.SILVER]: { minimumSpendVnd: 6_000_000 } }),
      'minimumSpendNotAscending',
    ],
    [
      'cashback over 100%',
      ladder({ [MembershipTierEnum.PLATINUM]: { cashbackPercent: 101 } }),
      'invalidCashbackPercent',
    ],
    [
      'a negative referral reward',
      ladder({ [MembershipTierEnum.GOLD]: { referralRewardVnd: -1 } }),
      'invalidReferralReward',
    ],
  ])('should reject %s', (_label, table, code) => {
    expect(validateTierLadder(table)?.code).toBe(code);
  });
});
