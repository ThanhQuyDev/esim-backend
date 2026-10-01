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

/**
 * How long a custom payment link stays payable (#056).
 *
 * OnePay gives a transaction 30 minutes; after that the link cannot be completed,
 * so leaving it in "Chờ thanh toán" tells an admin nothing. The sweep moves it to
 * FAILED, stamping `expiredAt` so the reason is recorded.
 */
export const CUSTOM_PAYMENT_LINK_EXPIRY_MINUTES = 30;
