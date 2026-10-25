/** The four tiers the programme started with; an admin can add more (vande #066). */
export enum MembershipTierEnum {
  TRAVELER = 'traveler',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

/**
 * A tier's code: one of the built-in four, or one an admin created in the CMS
 * ("kim-cuong"). Stored as text everywhere a tier is recorded.
 */
export type MembershipTierCode = string;

export enum TierSourceEnum {
  AUTOMATIC = 'automatic',
  OVERRIDE = 'override',
}

export enum UserSpendTransactionTypeEnum {
  PURCHASE = 'purchase',
  REFUND = 'refund',
  BACKFILL = 'backfill',
  ADMIN_ADJUSTMENT = 'admin_adjustment',
}
