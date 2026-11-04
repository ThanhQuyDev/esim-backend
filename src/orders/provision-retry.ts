/**
 * Automatic retry of a paid line the supplier never took (vande #003).
 *
 * The payment callback asks the supplier for the eSIM once. When the supplier
 * refused — eSIM Access answered 200006 for every multi-day pass until 10/10 —
 * the line sat at "pending" with no request id for good: paid, no eSIM, and
 * nothing in the CMS saying why. The refusal is now kept on the line, shown in
 * the order, and the line is asked again on a widening schedule.
 *
 * A repeat must never buy a second eSIM, and what makes it safe differs:
 *
 * - eSIM Access takes our `transactionId` (`<orderNumber>-esimaccess`), the same
 *   on every try, so even a try whose answer was lost is safe to repeat: the
 *   supplier refuses the repeat and the retry stops.
 * - The others have no such promise, so they are asked again only after a
 *   definite refusal (vande-0411 #005): the supplier answered and said no, as
 *   with Airalo's 429. A timeout or a 5xx may have gone through, so that line
 *   keeps the error for a person to check before pressing "Gọi lại API".
 */
export const AUTO_RETRY_PROVIDERS = ['esimaccess'];

/** Asked again only after {@link isDefiniteRefusal}. */
export const REFUSAL_RETRY_PROVIDERS = [
  'airalo',
  'gadgetkorea',
  'microesim',
  'billion',
];

export const ALL_RETRY_PROVIDERS = [
  ...AUTO_RETRY_PROVIDERS,
  ...REFUSAL_RETRY_PROVIDERS,
];

/** Lines of one supplier asked again per run, so a rate limit can recover. */
export const RETRY_LINES_PER_RUN = 5;

/** Tries in total, the first one being the payment callback's own: about an hour. */
export const MAX_PROVISION_ATTEMPTS = 13;

/** Only orders this recent are retried: an old refusal needs a person. */
export const AUTO_RETRY_WINDOW_HOURS = 24;

/**
 * Wait between tries: the job runs every 5 minutes, and 4 keeps a try from
 * missing its run by a few seconds and waiting 10 (vande-0411 #005).
 */
export const RETRY_DELAY_MINUTES = 4;

/**
 * The supplier answered and refused, so nothing was bought: an HTTP 4xx (not
 * 408, a timeout), or the refusal our MicroEsim and Billion clients raise from a
 * normal answer. Anything else may have gone through.
 */
export function isDefiniteRefusal(message: string | null): boolean {
  const text = message ?? '';
  const status = text.match(/status code (\d{3})/i);
  if (status) {
    const code = Number(status[1]);
    return code >= 400 && code < 500 && code !== 408;
  }
  return /^(MicroEsim API error|BILLION F040 error):/.test(text);
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
  const supplier = (provider ?? '').toLowerCase();
  if (
    !AUTO_RETRY_PROVIDERS.includes(supplier) &&
    !(
      REFUSAL_RETRY_PROVIDERS.includes(supplier) &&
      isDefiniteRefusal(item.lastProvisionError ?? null)
    )
  ) {
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
  return new Date(last.getTime() + RETRY_DELAY_MINUTES * 60_000);
}
