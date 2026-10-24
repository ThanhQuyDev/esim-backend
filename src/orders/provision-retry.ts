/**
 * Automatic retry of a paid line the supplier never took (vande #003).
 *
 * The payment callback asks the supplier for the eSIM once. When the supplier
 * refused — eSIM Access answered 200006 for every multi-day pass until 10/10 —
 * the line sat at "pending" with no request id for good: paid, no eSIM, and
 * nothing in the CMS saying why. The refusal is now kept on the line, shown in
 * the order, and the line is asked again on a widening schedule.
 *
 * Only suppliers whose order call is safe to repeat are retried on their own:
 * eSIM Access takes our `transactionId` (`<orderNumber>-esimaccess`), the same
 * on every try, so a try whose answer was lost cannot buy a second eSIM — the
 * supplier refuses the repeat instead, and the retry stops. Airalo has no such
 * key; its lines keep the error for the admin's "Gọi lại API" button.
 */
export const AUTO_RETRY_PROVIDERS = ['esimaccess'];

/** Tries in total, the first one being the payment callback's own. */
export const MAX_PROVISION_ATTEMPTS = 5;

/** Only orders this recent are retried: an old refusal needs a person. */
export const AUTO_RETRY_WINDOW_HOURS = 24;

/** Wait after try n (1-based) before try n + 1. */
const RETRY_DELAYS_MINUTES = [5, 15, 30, 60];

export function retryDelayMinutes(attempts: number): number {
  return RETRY_DELAYS_MINUTES[
    Math.min(Math.max(attempts, 1), RETRY_DELAYS_MINUTES.length) - 1
  ];
}

/**
 * The supplier refused a repeat of an order it already has: the first try did
 * go through. Retrying again cannot help, and the eSIM has to be looked up by
 * hand on the supplier's portal.
 */
export function isDuplicateOrderRefusal(message: string | null): boolean {
  return /duplicat|already exist|repeat(ed)? (transaction|order)|transactionId.*(exist|used)/i.test(
    message ?? '',
  );
}

export function provisionErrorText(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

/**
 * When the automatic retry will ask the supplier again, or null when it will
 * not (supplier not retried automatically, line already taken, tries used up,
 * order too old or not paid).
 */
export function nextAutoRetryAt(
  order: { status?: string | null; createdAt?: Date | string | null },
  item: {
    orderRequestId?: string | null;
    provisionAttempts?: number | null;
    lastProvisionError?: string | null;
    lastProvisionAttemptAt?: Date | string | null;
  },
  provider: string | null,
  now: Date = new Date(),
): Date | null {
  if (!AUTO_RETRY_PROVIDERS.includes((provider ?? '').toLowerCase())) {
    return null;
  }
  if (order.status !== 'paid' || item.orderRequestId) return null;
  const attempts = item.provisionAttempts ?? 0;
  if (attempts >= MAX_PROVISION_ATTEMPTS) return null;
  if (isDuplicateOrderRefusal(item.lastProvisionError ?? null)) return null;
  const created = order.createdAt ? new Date(order.createdAt) : null;
  if (
    !created ||
    now.getTime() - created.getTime() > AUTO_RETRY_WINDOW_HOURS * 3600_000
  ) {
    return null;
  }
  const last = item.lastProvisionAttemptAt
    ? new Date(item.lastProvisionAttemptAt)
    : null;
  if (!last) return now;
  return new Date(last.getTime() + retryDelayMinutes(attempts) * 60_000);
}
