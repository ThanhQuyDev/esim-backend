export enum WalletStatusEnum {
  ACTIVE = 'active',
  LOCKED = 'locked',
}

export enum WalletTransactionTypeEnum {
  ORDER_CASHBACK = 'order_cashback',
  ORDER_CASHBACK_REVERSAL = 'order_cashback_reversal',
  REFERRAL_REWARD = 'referral_reward',
  REFERRAL_REWARD_REVERSAL = 'referral_reward_reversal',
  REFUND_TO_WALLET = 'refund_to_wallet',
  MANUAL_CREDIT = 'manual_credit',
  MANUAL_DEBIT = 'manual_debit',
  MANUAL_CANCEL = 'manual_cancel',
  REDEMPTION_CAPTURE = 'redemption_capture',
  REDEMPTION_RELEASE = 'redemption_release',
  EXPIRY_DEBIT = 'expiry_debit',
}

export enum WalletHoldStatusEnum {
  HELD = 'held',
  CAPTURED = 'captured',
  RELEASED = 'released',
  EXPIRED = 'expired',
}

export enum OrderReferralStatusEnum {
  PENDING = 'pending',
  CREDITED = 'credited',
  REVERSED = 'reversed',
}

export enum OrderRefundModeEnum {
  WALLET = 'wallet',
  DIRECT_BANK = 'direct_bank',
}

export enum OrderRefundStatusEnum {
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export const EXU_EXPIRY_DAYS = 365;
export const EXU_CASHBACK_PERCENT = 2;
export const REFERRAL_MIN_ORDER_VND = 100_000;
export const REFERRAL_DISCOUNT_VND = 10_000;
export const REFERRAL_REWARD_VND = 10_000;
