import { TIER_BENEFITS, TIER_ORDER } from './tier.constants';
import { MembershipTierEnum } from './tier.enum';
import { getTierBenefits, resolveTierSummary } from './tier.resolver';

/**
 * The four membership tiers and what each one is worth (#058).
 *
 * The thresholds already had tests; the *benefit* numbers did not — and those
 * are the money: the cashback percentage is snapshotted onto every order and the
 * referral reward is paid out in eXU. A silent edit here would quietly change
 * what every customer earns, so the table is pinned against the spec verbatim.
 *
 *   Du khách          — from 0đ:          2% cashback, 10.000đ per referral
 *   Du khách bạc      — from 1.000.000đ:  3% cashback, 12.000đ per referral
 *   Du khách vàng     — from 5.000.000đ:  4% cashback, 15.000đ per referral
 *   Du khách bạch kim — from 25.000.000đ: 7% cashback, 20.000đ per referral
 */

const SPEC: Array<[MembershipTierEnum, number, number, number]> = [
  [MembershipTierEnum.TRAVELER, 0, 2, 10_000],
  [MembershipTierEnum.SILVER, 1_000_000, 3, 12_000],
  [MembershipTierEnum.GOLD, 5_000_000, 4, 15_000],
  [MembershipTierEnum.PLATINUM, 25_000_000, 7, 20_000],
];

describe('Membership tier benefits', () => {
  it.each(SPEC)(
    '%s should require %i VND and give %i%% cashback plus %i VND per referral',
    (tier, minimumSpendVnd, cashbackPercent, referralRewardVnd) => {
      expect(getTierBenefits(tier)).toEqual({
        minimumSpendVnd,
        cashbackPercent,
        referralRewardVnd,
      });
    },
  );

  it('should have exactly the four tiers, cheapest first', () => {
    // Order matters: `resolveAutomaticTier` walks it backwards, and progress to
    // the next tier is read off the neighbour.
    expect([...TIER_ORDER]).toEqual(SPEC.map(([tier]) => tier));
    expect(Object.keys(TIER_BENEFITS)).toHaveLength(4);
  });

  it('should never let a higher tier be worth less than a lower one', () => {
    for (let index = 1; index < TIER_ORDER.length; index += 1) {
      const lower = TIER_BENEFITS[TIER_ORDER[index - 1]];
      const higher = TIER_BENEFITS[TIER_ORDER[index]];

      expect(higher.minimumSpendVnd).toBeGreaterThan(lower.minimumSpendVnd);
      expect(higher.cashbackPercent).toBeGreaterThan(lower.cashbackPercent);
      expect(higher.referralRewardVnd).toBeGreaterThan(lower.referralRewardVnd);
    }
  });
});

describe('What a customer actually earns at a given spend', () => {
  it.each([
    [0, 2, 10_000],
    [999_999, 2, 10_000],
    [1_000_000, 3, 12_000],
    [5_000_000, 4, 15_000],
    [24_999_999, 4, 15_000],
    [25_000_000, 7, 20_000],
    [100_000_000, 7, 20_000],
  ])(
    'after spending %i VND: %i%% cashback and %i VND per referral',
    (spend, cashbackPercent, referralRewardVnd) => {
      const benefits = resolveTierSummary(spend).benefits;

      expect(benefits.cashbackPercent).toBe(cashbackPercent);
      expect(benefits.referralRewardVnd).toBe(referralRewardVnd);
    },
  );

  it('should pay the manually granted tier, not the earned one', () => {
    // An admin override is how support hands out a tier; the benefits must
    // follow the granted tier or the override buys nothing.
    const summary = resolveTierSummary(0, MembershipTierEnum.GOLD);

    expect(summary.benefits.cashbackPercent).toBe(4);
    expect(summary.benefits.referralRewardVnd).toBe(15_000);
  });

  it('should treat a missing or negative spend as a new customer', () => {
    for (const spend of [-1, Number.NaN, 0]) {
      expect(resolveTierSummary(spend).benefits.cashbackPercent).toBe(2);
    }
  });
});
