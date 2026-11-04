/**
 * How long an unpaid order waits for its money before the expiry job writes it
 * off. The storefront counts down the same time on a bank transfer
 * (vande-0411 #053).
 */
export const PENDING_ORDER_TTL_MINUTES = 30;
