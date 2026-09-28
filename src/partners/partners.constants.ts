/**
 * Programme thresholds. Declared once so the validation on a request and the
 * policy the admin console publishes can never drift apart.
 */

/** Smallest withdrawal a partner may request. */
export const PARTNER_PAYOUT_MIN_VND = 50_000;

/** Smallest ký quỹ top-up a distribution partner may request. */
export const PARTNER_DEPOSIT_MIN_VND = 100_000;

/** Largest ký quỹ top-up in one go (#047). */
export const PARTNER_DEPOSIT_MAX_VND = 10_000_000;

/**
 * What a card top-up costs the partner (#047).
 *
 * Paying by card goes through OnePay, which charges for it, and the brief puts
 * that cost on the partner rather than on esim.vn: send 100.000đ by card and
 * 94.000đ reaches the wallet. A bank transfer costs nothing, so it is credited
 * in full.
 */
export const PARTNER_CARD_TOPUP_FEE_PERCENT = 6;

/**
 * Prefix on the OnePay transaction reference of a partner top-up, so the IPN
 * handler can tell one from an order (#047).
 */
export const PARTNER_DEPOSIT_REF_PREFIX = 'PDEP';
