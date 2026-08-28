import { TIER_BENEFITS } from './tier.constants';
import { MembershipTierEnum, TierSourceEnum } from './tier.enum';
import { resolveAutomaticTier, resolveTierSummary } from './tier.resolver';

const TIER_BOUNDARIES: Array<[number, MembershipTierEnum]> = [
  [0, MembershipTierEnum.TRAVELER],
  [999_999, MembershipTierEnum.TRAVELER],
  [1_000_000, MembershipTierEnum.SILVER],
  [4_999_999, MembershipTierEnum.SILVER],
  [5_000_000, MembershipTierEnum.GOLD],
  [24_999_999, MembershipTierEnum.GOLD],
  [25_000_000, MembershipTierEnum.PLATINUM],
];

describe('tier resolver', () => {
  it.each(TIER_BOUNDARIES)(
    'resolves %i VND to %s',
    (lifetimeSpendVnd, expectedTier) => {
      expect(resolveAutomaticTier(lifetimeSpendVnd)).toBe(expectedTier);
    },
  );

  it('should use the override tier and its full benefit set', () => {
    const summary = resolveTierSummary(1_000_000, MembershipTierEnum.PLATINUM);

    expect(summary.automaticTier).toBe(MembershipTierEnum.SILVER);
    expect(summary.membershipTier).toBe(MembershipTierEnum.PLATINUM);
    expect(summary.tierSource).toBe(TierSourceEnum.OVERRIDE);
    expect(summary.benefits).toEqual(
      TIER_BENEFITS[MembershipTierEnum.PLATINUM],
    );
  });

  it('should report progress toward the next automatic tier', () => {
    expect(resolveTierSummary(500_000).progressPercent).toBe(50);
    expect(resolveTierSummary(3_000_000).progressPercent).toBe(50);
    expect(resolveTierSummary(15_000_000).progressPercent).toBe(50);

    const platinum = resolveTierSummary(25_000_000);
    expect(platinum.nextTier).toBeNull();
    expect(platinum.nextTierThresholdVnd).toBeNull();
    expect(platinum.progressPercent).toBe(100);
  });
});
