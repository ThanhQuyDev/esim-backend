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
  /** Refused outright, and worth 0đ — see `rejectionReason` (#041). */
  REJECTED = 'rejected',
}

/**
 * Why an order earned the partner nothing (#041).
 *
 * A self-referral is always refused: the buyer's details are the partner's own.
 * The reason is kept so whoever answers the partner's complaint can say which
 * detail matched, rather than reading it off a server log.
 */
export enum CommissionRejectionReasonEnum {
  /** The order was placed from the partner's own account. */
  SELF_ACCOUNT = 'self_account',
  SELF_EMAIL = 'self_email',
  SELF_PHONE = 'self_phone',
  SELF_TAX_CODE = 'self_tax_code',
  SELF_BANK_ACCOUNT = 'self_bank_account',
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

/**
 * How a partner tops up their ký quỹ wallet (#047).
 *
 * A bank transfer is matched by SePay and credited in full. A card payment goes
 * through OnePay and carries the gateway's fee, which the partner pays.
 */
export enum PartnerTopupMethodEnum {
  BANK_TRANSFER = 'bank_transfer',
  CARD = 'card',
}
