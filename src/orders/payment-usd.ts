/**
 * "payment $" (doitac-3010 #043).
 *
 * The English storefront shows prices in $, but every gateway charges VND. A
 * foreign buyer who sees the VND figure at payment may walk away, leaving a
 * pending or failed order. The admin wants those counted, to decide whether a
 * USD gateway is worth adding — so such an order carries this mark.
 */
export const PAYMENT_USD_LABEL = 'payment $';

/** Statuses of an order that was never paid. */
export const UNPAID_ORDER_STATUSES = ['pending', 'failed'] as const;

/** The storefront language the order came from, as stored. */
export function checkoutLocaleOf(
  locale: string | null | undefined,
): string | null {
  const value = String(locale ?? '')
    .trim()
    .toLowerCase();
  if (!value) return null;
  return value.startsWith('en') ? 'en' : 'vi';
}

export function isPaymentUsdIssue(order: {
  checkoutLocale?: string | null;
  status?: string | null;
}): boolean {
  return (
    order.checkoutLocale === 'en' &&
    (UNPAID_ORDER_STATUSES as readonly string[]).includes(
      String(order.status ?? ''),
    )
  );
}
