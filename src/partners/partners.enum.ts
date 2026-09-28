export enum PartnerTypeEnum {
  DISTRIBUTION = 'distribution',
  KOL = 'kol',
}

export enum PartnerLegalTypeEnum {
  INDIVIDUAL = 'individual',
  COMPANY = 'company',
}

export enum PartnerStatusEnum {
  PENDING = 'pending',
  ACTIVE = 'active',
  HOLD = 'hold',
  DISABLED = 'disabled',
  REJECTED = 'rejected',
}

export enum PartnerWalletStatusEnum {
  ACTIVE = 'active',
  LOCKED = 'locked',
}

export enum PartnerWalletTransactionTypeEnum {
  DEPOSIT = 'deposit',
  MANUAL_CREDIT = 'manual_credit',
  MANUAL_DEBIT = 'manual_debit',
  ORDER_PURCHASE = 'order_purchase',
  ORDER_PURCHASE_REVERSAL = 'order_purchase_reversal',
  COMMISSION_EARNED = 'commission_earned',
  COMMISSION_REVERSED = 'commission_reversed',
  PAYOUT = 'payout',
  PAYOUT_REJECTED = 'payout_rejected',
}

export enum PartnerDepositRequestStatusEnum {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export enum PartnerLinkStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum OrderPartnerCommissionStatusEnum {
  PENDING = 'pending',
  CREDITED = 'credited',
  REVERSED = 'reversed',
}

export enum PartnerPayoutStatusEnum {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
}

export const PARTNER_LINK_COOKIE_NAME = 'esim_partner_link';
export const PARTNER_LINK_ATTRIBUTION_DAYS = 30;

/**
 * The steps of a buying session worth recording (#040).
 *
 * Only the ones that say something about intent: a visitor comparing plans,
 * settling on one, and going to pay. Enough to tell a real visit from an order
 * that jumped straight from the click to the payment page.
 */
export enum SessionEventTypeEnum {
  PLAN_LIST = 'plan_list',
  PLAN_VIEW = 'plan_view',
  ADD_TO_CART = 'add_to_cart',
  CHECKOUT_START = 'checkout_start',
}

/**
 * What the recorded steps say about a session (#040).
 *
 * Never a reason to refuse an order — the brief asks for the pattern to be
 * visible, and #036 already settled that a flagged order still earns.
 */
export enum SessionShapeEnum {
  /** Compared a plan or two, added to the cart, went to pay. */
  NATURAL = 'natural',
  /** Straight from the click to the payment page, nothing looked at. */
  NO_BROWSING = 'no_browsing',
  /** Dozens of plans in seconds: nobody reads that fast. */
  INHUMAN_SPEED = 'inhuman_speed',
}
