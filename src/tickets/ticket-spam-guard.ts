/**
 * Server-side spam guard for the public support form (#033).
 *
 * The storefront already refuses a bot-looking submission (honeypot, fill-time
 * trap, per-browser limit, duplicate), but all of that runs in the visitor's own
 * browser: a script posting straight to `POST /api/v1/tickets`, or anyone who
 * clears localStorage, walked past every check. These limits are the ones the
 * server enforces whatever the client does. They sit a little above the
 * browser's own (3 per 10 minutes), so an honest customer meets the friendly
 * message in the form long before the server ever has to refuse them.
 */

/** Tickets one IP address may open in {@link TICKET_IP_WINDOW_MS}. */
export const TICKET_IP_LIMIT = 5;
export const TICKET_IP_WINDOW_MS = 10 * 60 * 1000;

/** Tickets one email address may open in {@link TICKET_EMAIL_WINDOW_MS}. */
export const TICKET_EMAIL_LIMIT = 5;
export const TICKET_EMAIL_WINDOW_MS = 60 * 60 * 1000;

/** The same email + subject + description again within this window is a duplicate. */
export const TICKET_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export type RateVerdict = { ok: true } | { ok: false; retryAfterMs: number };

/**
 * A sliding-window counter kept in memory. One API process serves the site, so
 * memory is enough; the per-email limit is checked against the database and
 * holds even across restarts.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Record an attempt for `key` and say whether it is within the limit. */
  hit(key: string, now: number = Date.now()): RateVerdict {
    const recent = (this.hits.get(key) ?? []).filter(
      (at) => now - at < this.windowMs,
    );

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterMs: this.windowMs - (now - recent[0]) };
    }

    recent.push(now);
    this.hits.set(key, recent);
    this.sweep(now);
    return { ok: true };
  }

  /** Forget keys with no attempts left in the window, so the map cannot grow forever. */
  private sweep(now: number): void {
    if (this.hits.size < 1000) return;
    for (const [key, times] of this.hits) {
      if (times.every((at) => now - at >= this.windowMs)) this.hits.delete(key);
    }
  }
}

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
};

/**
 * The visitor's IP address. Behind nginx every request comes from 127.0.0.1, so
 * the address nginx writes into `X-Real-IP` (it overwrites whatever the client
 * sent) is the one that identifies the visitor.
 */
export function clientIp(request: RequestLike): string {
  const realIp = request.headers?.['x-real-ip'];
  const fromProxy = Array.isArray(realIp) ? realIp[0] : realIp;
  return (
    fromProxy?.trim() ||
    request.ip ||
    request.socket?.remoteAddress ||
    'unknown'
  );
}
