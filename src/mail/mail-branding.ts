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

/**
 * The mailbox support actually reads.
 *
 * `support@esim.com.vn` as of #062 — the mailbox the ticket flow both sends from
 * and polls for replies. It has to stay equal to `MAIL_INBOUND_USER`, or a
 * customer pressing Reply on a ticket email reaches somewhere nobody reads and
 * the reply never joins its thread. `TicketMailData` resolves `replyTo` from the
 * polled mailbox for exactly that reason, with this as the fallback.
 *
 * (Was `hotro@esim.com.vn`, and before that `support@esim.vn` — note the
 * different domain — which was unread; see the file comment above.)
 */
export const SUPPORT_EMAIL = 'support@esim.com.vn';

/**
 * The brand every email shows (#012, test round 4). It used to be the API's
 * `APP_NAME`, which on the servers reads "ESIM.VN API" — so customers saw
 * "© ESIM.VN API" under their order email.
 */
export const BRAND_NAME = 'ESIM.VN';

/** Where the brand links to — always https (#012). */
export const SITE_URL = 'https://esim.vn';
