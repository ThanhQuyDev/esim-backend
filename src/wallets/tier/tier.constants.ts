import { MembershipTierEnum } from './tier.enum';

export type TierBenefits = {
  minimumSpendVnd: number;
  cashbackPercent: number;
  referralRewardVnd: number;
};

export const TIER_BENEFITS: Record<MembershipTierEnum, TierBenefits> = {
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

export const TIER_ORDER = [
  MembershipTierEnum.TRAVELER,
  MembershipTierEnum.SILVER,
  MembershipTierEnum.GOLD,
  MembershipTierEnum.PLATINUM,
] as const;
