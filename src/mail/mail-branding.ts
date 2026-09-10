/**
 * Brand details every outgoing email shares (#079).
 *
 * The logo URL was pasted literally into each sender, and the invoice email
 * carried a support address we do not read — `support@esim.vn` — so a customer
 * asking about their e-invoice wrote into a void. One place to change means the
 * next rebrand cannot leave one template behind.
 */

/** Horizontal brand logo, hosted where a mail client can fetch it. */
export const BRAND_LOGO_URL =
  'https://res.cloudinary.com/drozbviwb/image/upload/v1780067058/logo_esimvn_zycejk.png';

/** The mailbox support actually reads. */
export const SUPPORT_EMAIL = 'hotro@esim.com.vn';
