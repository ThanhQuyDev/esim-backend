/**
 * Programme thresholds. Declared once so the validation on a request and the
 * policy the admin console publishes can never drift apart.
 */

/** Smallest withdrawal a partner may request. */
export const PARTNER_PAYOUT_MIN_VND = 50_000;

/** Smallest ký quỹ top-up a distribution partner may request. */
export const PARTNER_DEPOSIT_MIN_VND = 100_000;
