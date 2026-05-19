export enum CustomPaymentLinkStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

/**
 * All virtual order numbers issued for Custom Payment Links must start with this
 * prefix. The OnePay IPN handler relies on this prefix to route callbacks to
 * the custom payment links service instead of the standard orders flow.
 */
export const CUSTOM_PAYMENT_VIRTUAL_ORDER_PREFIX = 'VORD-';
