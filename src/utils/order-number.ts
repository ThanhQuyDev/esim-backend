import { randomInt } from 'node:crypto';

/**
 * Order codes that show when the order was placed (#078).
 *
 * They used to carry `Date.now()` — `ORD-1790360805694-NZ7UEC`. That is a real
 * timestamp, but nobody reads epoch milliseconds, so support had to open the
 * order to find out when it was placed. The same thirteen digits become
 * `ORD-260925210805694-NZ7UEC`, which reads straight off as 21:08:05 on
 * 25/09/2026.
 *
 * The layout is `yyMMddHHmmssSSS`: date first so codes still sort
 * chronologically as text, and the milliseconds kept because they are what makes
 * two orders placed in the same second distinguishable.
 */

/**
 * Vietnam is UTC+7 all year — no daylight saving — so a fixed offset is exact.
 * The time has to be Vietnamese: a code read as "21:08" by the staff who placed
 * the order is the whole point, and a server running in UTC would stamp 14:08.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Base36 uppercase, matching the suffix these codes have always used. */
const SUFFIX_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SUFFIX_LENGTH = 6;

/** The date-time part of an order code: `yyMMddHHmmssSSS`, in Vietnam time. */
export function orderNumberTimestamp(at: Date): string {
  const vn = new Date(at.getTime() + VN_OFFSET_MS);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');

  return [
    pad(vn.getUTCFullYear() % 100),
    pad(vn.getUTCMonth() + 1),
    pad(vn.getUTCDate()),
    pad(vn.getUTCHours()),
    pad(vn.getUTCMinutes()),
    pad(vn.getUTCSeconds()),
    pad(vn.getUTCMilliseconds(), 3),
  ].join('');
}

/**
 * The random tail that keeps two orders in the same millisecond apart.
 *
 * Drawn a character at a time rather than from `Math.random().toString(36)`,
 * which was the old approach: that yields a *variable* number of characters —
 * `Math.random()` returning 0.5 gives "0.i", and the slice is then a single
 * character — so some codes came out shorter than intended, with that much less
 * room between them.
 */
function randomSuffix(): string {
  let suffix = '';
  for (let index = 0; index < SUFFIX_LENGTH; index += 1) {
    suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }
  return suffix;
}

/**
 * A fresh order code, e.g. `ORD-260925210805694-NZ7UEC`.
 *
 * `prefix` carries its own separator so the virtual orders behind custom payment
 * links keep their `VORD-` marker, which the payment webhook routes on.
 */
export function generateOrderNumber(prefix = 'ORD-', at = new Date()): string {
  return `${prefix}${orderNumberTimestamp(at)}-${randomSuffix()}`;
}
