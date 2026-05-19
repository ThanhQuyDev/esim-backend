/**
 * Internal status values used for Topup orders.
 *
 * The base `OrderEntity.status` is a string; we reuse it here to avoid
 * adding a new column. Topup-specific values are PascalCase to match
 * the spec, while inherited values (`pending`, `paid`, `failed`,
 * `completed`) keep their lowercase form set elsewhere in the system.
 */
export const TOPUP_ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  COMPLETED: 'completed',
  FAILED: 'failed',
  /**
   * Provider API call (Airalo / EsimAccess / Gadget Korea) failed after
   * the customer already paid. Admin must intervene to either retry or
   * refund — money has been collected but the topup wasn't applied.
   */
  MANUAL_INTERVENTION: 'MANUAL_INTERVENTION',
} as const;

export type TopupOrderStatus =
  (typeof TOPUP_ORDER_STATUS)[keyof typeof TOPUP_ORDER_STATUS];

export const TOPUP_ORDER_NUMBER_PREFIX = 'TOPUP';

/**
 * `Order.orderType` values.
 */
export enum OrderType {
  BUY_NEW = 'BUY_NEW',
  TOPUP = 'TOPUP',
}
