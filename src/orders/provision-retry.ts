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

/**
 * Tries of one supplier per run, so a rate limit can recover. A "try" is one
 * call: all the eSIM Access lines of an order (they share one transaction id),
 * or one line of any other supplier.
 */
export const RETRY_LINES_PER_RUN = 5;

/**
 * Tries in total, the first one being the order's own. With a try every 1–4
 * minutes that is about half an hour of automatic tries; after that the line
 * waits for "Gọi lại API" or a refund (vande-1411 #001).
 */
export const MAX_PROVISION_ATTEMPTS = 13;

/** Only orders this recent are retried: an old refusal needs a person. */
export const AUTO_RETRY_WINDOW_HOURS = 24;

/**
 * Wait after a failed try (vande-1411 #001): between 1 and 4 minutes, a
 * different wait for each eSIM so two lines refused together are not asked
 * again at the same second. The job runs every minute, so the try happens at
 * most a minute later: always within the 1–5 minutes anh Thọ asked for.
 */
export const RETRY_DELAY_MIN_SECONDS = 60;
export const RETRY_DELAY_MAX_SECONDS = 240;

/**
 * Gap between two calls of one run (vande-1411 #001): 10–20 seconds, so ten
 * refused eSIMs are never sent to the supplier in the same instant.
 */
export const RETRY_STAGGER_MIN_MS = 10_000;
export const RETRY_STAGGER_MAX_MS = 20_000;

/** A supplier's Retry-After is honoured up to this long. */
export const MAX_RETRY_AFTER_SECONDS = 30 * 60;

/** Random gap before the next call of a run, in milliseconds. */
export function retryStaggerMs(random: () => number = Math.random): number {
  return Math.round(
    RETRY_STAGGER_MIN_MS +
      random() * (RETRY_STAGGER_MAX_MS - RETRY_STAGGER_MIN_MS),
  );
}

/**
 * The wait after a failed try of this line, in seconds. Fixed for a given line
 * and try, so the time the CMS shows is the time the job uses.
 */
export function retryDelaySeconds(
  itemId: number | null | undefined,
  attempts: number,
): number {
  const span = RETRY_DELAY_MAX_SECONDS - RETRY_DELAY_MIN_SECONDS;
  if (itemId == null || !Number.isFinite(Number(itemId))) {
    return RETRY_DELAY_MIN_SECONDS + Math.round(span / 2);
  }
  // A small integer hash: spreads neighbouring ids and tries over the span.
  let h = (Math.imul(Number(itemId) | 0, 2654435761) + attempts * 40503) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return RETRY_DELAY_MIN_SECONDS + (h % (span + 1));
}

/** The supplier's Retry-After kept in the error text, in seconds, if any. */
export function retryAfterSeconds(message: string | null): number | null {
  const m = (message ?? '').match(/Retry-After: (\d+)s/);
  if (!m) return null;
  return Math.min(Number(m[1]), MAX_RETRY_AFTER_SECONDS);
}

/** A rate limit: the supplier wants fewer calls, not none. */
export function isRateLimited(message: string | null): boolean {
  return /status code 429\b/.test(message ?? '');
}

/**
 * The call never reached the supplier, so nothing can have been bought
 * (vande-2011 #001): the supplier's name did not resolve (DNS `EAI_AGAIN`,
 * `ENOTFOUND` — production's resolver fails now and then), the connection was
 * refused or the network unreachable, or the supplier said 503 "unavailable".
 * Gadget Korea's `getaddrinfo EAI_AGAIN open-api.usimsa.com` was left for a
 * person after one try although asking again was perfectly safe.
 */
export function isNeverSent(message: string | null): boolean {
  const text = message ?? '';
  if (
    /\b(EAI_AGAIN|ENOTFOUND|EAI_NONAME|EAI_FAIL|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH)\b/.test(
      text,
    )
  ) {
    return true;
  }
  return /status code 503\b/.test(text);
}

/**
 * Nothing was bought, so asking again is safe: the supplier answered and
 * refused — an HTTP 4xx (not 408, a timeout), or the refusal our MicroEsim and
 * Billion clients raise from a normal answer — or the call never reached it
 * ({@link isNeverSent}). Anything else (a timeout, a reset connection, a 500)
 * may have gone through.
 */
export function isDefiniteRefusal(message: string | null): boolean {
  const text = message ?? '';
  if (isNeverSent(text)) return true;
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
  let text = err instanceof Error ? err.message : String(err);
  // Keep the supplier's Retry-After so the next try waits for it (#001).
  const header = (
    err as { response?: { headers?: Record<string, unknown> } } | null
  )?.response?.headers?.['retry-after'];
  const wait = parseRetryAfter(header);
  if (wait != null) text = `${text} (Retry-After: ${wait}s)`;
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

/** Retry-After is either seconds or an HTTP date. */
function parseRetryAfter(
  value: unknown,
  now: Date = new Date(),
): number | null {
  if (value == null) return null;
  const raw = String(Array.isArray(value) ? value[0] : value).trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now.getTime()) / 1000));
}

/**
 * Why the automatic retry will not ask the supplier again (vande-2011 #001),
 * so the order can say what to do instead of a bare "stopped":
 *
 * - `unsure`: the last error may have bought the eSIM (a timeout, a reset, a
 *   500) and this supplier has no safe repeat — check its portal first.
 * - `duplicate`: the supplier says it already has this order.
 * - `attempts` / `window`: tries used up, or the order is over a day old.
 *
 * Null while the retry is still going (or for a line that needs none).
 */
export type AutoRetryStop = 'unsure' | 'duplicate' | 'attempts' | 'window';

export function autoRetryStopReason(
  order: { status?: string | null; createdAt?: Date | string | null },
  item: {
    status?: string | null;
    orderRequestId?: string | null;
    provisionAttempts?: number | null;
    lastProvisionError?: string | null;
  },
  provider: string | null,
  now: Date = new Date(),
): AutoRetryStop | null {
  if (!item.lastProvisionError || item.orderRequestId) return null;
  if (order.status !== 'paid') return null;
  if (item.status != null && item.status !== 'pending') return null;
  const supplier = (provider ?? '').toLowerCase();
  if (isDuplicateOrderRefusal(item.lastProvisionError)) return 'duplicate';
  if (
    !AUTO_RETRY_PROVIDERS.includes(supplier) &&
    !isDefiniteRefusal(item.lastProvisionError)
  ) {
    return 'unsure';
  }
  if ((item.provisionAttempts ?? 0) >= MAX_PROVISION_ATTEMPTS)
    return 'attempts';
  const created = order.createdAt ? new Date(order.createdAt) : null;
  if (
    !created ||
    now.getTime() - created.getTime() > AUTO_RETRY_WINDOW_HOURS * 3600_000
  ) {
    return 'window';
  }
  return null;
}

/**
 * When the automatic retry will ask the supplier again, or null when it will
 * not (supplier not retried automatically, line already taken, tries used up,
 * order too old or not paid).
 */
export function nextAutoRetryAt(
  order: { status?: string | null; createdAt?: Date | string | null },
  item: {
    id?: number | string | null;
    /** The job only takes pending lines: a refunded one is never asked again. */
    status?: string | null;
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
  if (item.status != null && item.status !== 'pending') return null;
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
  const wait = Math.max(
    retryDelaySeconds(item.id == null ? null : Number(item.id), attempts),
    retryAfterSeconds(item.lastProvisionError ?? null) ?? 0,
  );
  return new Date(last.getTime() + wait * 1000);
}
