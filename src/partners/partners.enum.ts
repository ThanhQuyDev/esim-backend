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
