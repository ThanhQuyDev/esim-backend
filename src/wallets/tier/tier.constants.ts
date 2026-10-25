import { MembershipTierEnum } from './tier.enum';

export type TierBenefits = {
  minimumSpendVnd: number;
  cashbackPercent: number;
  referralRewardVnd: number;
};

/** The starting ladder, until `membership_tier_config` has loaded. */
export const TIER_BENEFITS: Record<string, TierBenefits> = {
  [MembershipTierEnum.TRAVELER]: {
    minimumSpendVnd: 0,
    cashbackPercent: 2,
    referralRewardVnd: 10_000,
  },
  [MembershipTierEnum.SILVER]: {
    minimumSpendVnd: 1_000_000,
    cashbackPercent: 3,
    referralRewardVnd: 12_000,
  },
  [MembershipTierEnum.GOLD]: {
    minimumSpendVnd: 5_000_000,
    cashbackPercent: 4,
    referralRewardVnd: 15_000,
  },
  [MembershipTierEnum.PLATINUM]: {
    minimumSpendVnd: 25_000_000,
    cashbackPercent: 7,
    referralRewardVnd: 20_000,
  },
};

/** The built-in tiers' names, until an admin renames them (vande #066). */
export const DEFAULT_TIER_NAMES: Record<string, { vi: string; en: string }> = {
  [MembershipTierEnum.TRAVELER]: { vi: 'Du khách', en: 'Traveler' },
  [MembershipTierEnum.SILVER]: { vi: 'Du khách bạc', en: 'Silver Traveler' },
  [MembershipTierEnum.GOLD]: { vi: 'Du khách vàng', en: 'Gold Traveler' },
  [MembershipTierEnum.PLATINUM]: {
    vi: 'Du khách bạch kim',
    en: 'Platinum Traveler',
  },
};
