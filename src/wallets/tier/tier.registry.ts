import {
  DEFAULT_TIER_NAMES,
  TIER_BENEFITS,
  TierBenefits,
} from './tier.constants';
import { MembershipTierCode } from './tier.enum';

/** One tier as the CMS edits it: what it requires, pays and is called. */
export type TierRow = TierBenefits & {
  /** "Bạch kim" — what customers and admins read (vande #066). */
  name: string;
  nameEn: string | null;
};

export type TierBenefitsTable = Record<MembershipTierCode, TierRow>;

/**
 * The tier table the whole backend pays out from (#024).
 *
 * Admins edit the ladder in the CMS and it is stored in `membership_tier_config`,
 * but the resolver is called synchronously — from the user mapper, the wallet
 * summary and the order cashback snapshot — so the saved table is held here in
 * memory. The four built-in tiers are only the starting point until the
 * database copy has loaded; an admin can rename them and add more (vande #066).
 */
let current: TierBenefitsTable = defaultTable();

export function defaultTable(): TierBenefitsTable {
  return Object.fromEntries(
    Object.entries(TIER_BENEFITS).map(([tier, benefits]) => [
      tier,
      {
        ...benefits,
        name: DEFAULT_TIER_NAMES[tier]?.vi ?? tier,
        nameEn: DEFAULT_TIER_NAMES[tier]?.en ?? null,
      },
    ]),
  );
}

function cloneTable(table: TierBenefitsTable): TierBenefitsTable {
  return Object.fromEntries(
    Object.entries(table).map(([tier, row]) => [tier, { ...row }]),
  );
}

export function currentTierBenefits(): Readonly<TierBenefitsTable> {
  return current;
}

export function applyTierBenefits(table: TierBenefitsTable): void {
  current = cloneTable(table);
}

/**
 * The tiers lowest first. The ladder is ordered by what each one requires, so
 * a tier an admin adds falls into place by its threshold (vande #066).
 */
export function tierOrder(
  table: Readonly<TierBenefitsTable> = current,
): MembershipTierCode[] {
  return Object.keys(table).sort(
    (a, b) =>
      table[a].minimumSpendVnd - table[b].minimumSpendVnd || a.localeCompare(b),
  );
}

/** The tier everybody starts on: the one with no threshold. */
export function baseTier(
  table: Readonly<TierBenefitsTable> = current,
): MembershipTierCode {
  return tierOrder(table)[0];
}

export type TierLadderProblem = {
  tier: MembershipTierCode;
  field: keyof TierRow;
  code: string;
};

/**
 * Why this ladder cannot be used, or null when it can.
 *
 * The automatic tier walks the thresholds from the top down, so no two tiers
 * may share one and the first tier must start at 0đ — otherwise a new customer
 * would belong to no tier at all.
 */
export function validateTierLadder(
  table: TierBenefitsTable,
): TierLadderProblem | null {
  const order = tierOrder(table);
  if (!order.length) {
    return { tier: '', field: 'minimumSpendVnd', code: 'noTiers' };
  }
  for (let index = 0; index < order.length; index += 1) {
    const tier = order[index];
    const benefits = table[tier];

    if (!benefits.name?.trim()) {
      return { tier, field: 'name', code: 'nameRequired' };
    }
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
      benefits.minimumSpendVnd <= table[order[index - 1]].minimumSpendVnd
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
