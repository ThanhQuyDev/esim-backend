/**
 * How bot-like a click looked (doitac-3010 #020, rule 4).
 *
 * A declared bot — Googlebot, facebookexternalhit, curl — is turned away at
 * the redirect and never becomes a click. A bot that dresses up as
 * "Mozilla/5.0" gets through that check, so it is judged on several other
 * layers instead, and the click keeps a score and the reasons:
 *
 * - headers a real browser sends on a navigation and a script usually forgets
 *   (Accept-Language, Accept: text/html, Sec-Fetch-*, Client Hints) — checked
 *   by the storefront, which sees the request;
 * - an address in a data centre rather than a home or mobile network — also
 *   the storefront's, since only it sees the address;
 * - how often the same network clicks — checked here, against the click log;
 * - how the session behaved on the way to an order — the session journey
 *   (#040), judged when the order is placed.
 *
 * Nothing here refuses an order. A high score marks the order for an admin.
 */

/** Points per reason; the score is their sum, capped at 100. */
export const CLICK_BOT_FLAG_WEIGHTS = {
  /** No Accept-Language: every browser sends one. */
  no_accept_language: 25,
  /** A navigation that does not accept HTML. */
  accept_not_html: 20,
  /** A modern browser's user agent without its Sec-Fetch-* headers. */
  no_fetch_metadata: 25,
  /** A Chromium user agent without the sec-ch-ua Client Hint. */
  no_client_hints: 15,
  /** An address of a known hosting / cloud provider. */
  datacenter_ip: 40,
  /** The same network clicking far more often than a person does. */
  high_rate: 30,
} as const;

export type ClickBotFlag = keyof typeof CLICK_BOT_FLAG_WEIGHTS;

/** From this score on, an order through the click is marked "Click nghi bot". */
export const CLICK_BOT_SUSPECT_SCORE = 40;

/** Clicks from one network inside {@link CLICK_RATE_WINDOW_MS}. */
export const CLICK_RATE_SOFT_LIMIT = 10;
/** Past this the hits are not even recorded as raw clicks. */
export const CLICK_RATE_HARD_LIMIT = 30;
export const CLICK_RATE_WINDOW_MS = 10 * 60_000;

/** The known flags out of whatever the caller sent, deduplicated. */
export function knownBotFlags(
  flags: readonly unknown[] | null | undefined,
): ClickBotFlag[] {
  const known = new Set(Object.keys(CLICK_BOT_FLAG_WEIGHTS));
  return [
    ...new Set(
      (flags ?? []).filter(
        (flag): flag is ClickBotFlag =>
          typeof flag === 'string' && known.has(flag),
      ),
    ),
  ];
}

export function clickBotScore(flags: readonly ClickBotFlag[]): number {
  const sum = flags.reduce(
    (total, flag) => total + CLICK_BOT_FLAG_WEIGHTS[flag],
    0,
  );
  return Math.min(100, sum);
}
