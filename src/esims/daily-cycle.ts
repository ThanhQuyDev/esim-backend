/**
 * How the days of a plan are counted (vande #075).
 *
 * Two rules are in use across our suppliers, and the plan says which:
 *
 *  - `rolling_24h` — each day is 24 hours from the moment the eSIM first
 *    connected at the destination, so it ends at a different clock time for
 *    every customer;
 *  - `calendar_day` — each day is the supplier's calendar day, midnight to
 *    midnight in its own timezone (UTC+8 for the Chinese suppliers, UTC+7 for
 *    Viettel…), the same moment for everyone, and the day the eSIM connects
 *    counts as day one however late it is.
 *
 * Counting every plan by Vietnamese midnight, or by 24-hour blocks back from
 * the expiry, made a customer who had used an eSIM for an hour read that a day
 * was gone.
 */
export type DailyResetPolicy = 'rolling_24h' | 'calendar_day';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Whole calendar days since the epoch, in a timezone `offsetHours` from UTC. */
function calendarDay(at: number, offsetHours: number): number {
  return Math.floor((at + offsetHours * HOUR_MS) / DAY_MS);
}

/**
 * When a plan runs out, from when it first connected and how many days it
 * has — for when the supplier does not tell us. Null without both.
 */
export function derivedExpiry(
  activatedAt: Date | string | null | undefined,
  durationDays: number | null | undefined,
  policy: DailyResetPolicy | string | null | undefined,
  utcOffset: number | null | undefined,
): Date | null {
  if (!activatedAt || !durationDays || durationDays <= 0) return null;
  const start = new Date(activatedAt).getTime();
  if (Number.isNaN(start)) return null;
  if (policy === 'calendar_day') {
    const offset = utcOffset ?? 8;
    // Midnight, in the plan's timezone, after the last of its days.
    const lastMidnight =
      (calendarDay(start, offset) + durationDays) * DAY_MS - offset * HOUR_MS;
    return new Date(lastMidnight);
  }
  return new Date(start + durationDays * DAY_MS);
}
