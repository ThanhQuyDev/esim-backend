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

/**
 * `Order.paymentMethod` for a topup an admin applied without charging through
 * a gateway (#026). Kept distinct so these orders can be told apart from real
 * OnePay / bank-transfer payments when reconciling money.
 */
export const ADMIN_MANUAL_PAYMENT_METHOD = 'ADMIN_MANUAL';

/**
 * USD→VND rate used when the live rate is unavailable (#086).
 *
 * The same figure `PlanRepository.recalculatePricesByTiers` falls back to,
 * so a topup priced while the FX API is down still lands in the same margin
 * tier a SIM plan would. Checkout used to fall back to 26,000 here and the
 * pricing SQL to 25,500, which quietly put the two out of step.
 */
export const FALLBACK_USD_VND_RATE = 25500;
