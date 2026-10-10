import { VIETNAM_UTC_OFFSET } from './plan-daily-reset';

/**
 * "Kích hoạt eSIM trước ngày dd/mm/yyyy" — the date by which an eSIM has to be
 * activated or it is wasted (#070).
 *
 * The storefront used to print a flat "180 ngày kể từ ngày mua" for every plan,
 * with one hard-coded exception for Viettel. Suppliers actually allow anywhere
 * from 30 to 180 days, so that line was wrong for most of the catalogue — and a
 * customer who believes it and activates on day 90 of a 30-day window has lost
 * the eSIM.
 *
 * The deadline is computed here, on the API response, rather than in the browser:
 * the ticket counts it "từ ngày khách bấm xem sản phẩm", which is when this
 * response is built, and doing it server-side keeps one timezone (Vietnam) in
 * play instead of whatever the customer's device is set to.
 */

/** A calendar date with no time, as `yyyy-mm-dd`. */
export type IsoDate = string;

/**
 * The calendar date `at` falls on in Vietnam. Dates are rendered to Vietnamese
 * customers, so a purchase at 00:30 Hanoi time must not be reported as the day
 * before just because the server runs in UTC.
 */
export function vietnamDate(at: Date): IsoDate {
  const shifted = new Date(at.getTime() + VIETNAM_UTC_OFFSET * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The deadline for a plan whose supplier states a window in days: that many days
 * on from today, in Vietnam.
 *
 * Returns null when the supplier has not told us the window — the storefront
 * then keeps its generic wording rather than inventing a date, because a date is
 * read as a promise and a wrong one costs the customer their eSIM.
 */
export function activationDeadlineFromDays(
  validityDays: number | null | undefined,
  at: Date,
): IsoDate | null {
  if (validityDays == null) return null;
  const days = Number(validityDays);
  if (!Number.isFinite(days) || days <= 0) return null;

  const deadline = new Date(at.getTime() + days * 24 * 60 * 60 * 1000);
  return vietnamDate(deadline);
}

/**
 * Local stock is already sitting in the warehouse with a printed expiry, so its
 * deadline is that date and not a count from today (#070: "dựa vào cột ngày hết
 * hạn trong file import"). A date already in the past is dropped: such an eSIM is
 * not sellable stock anyway, and a deadline in the past reads as a bug.
 */
export function activationDeadlineFromExpiry(
  expiresAt: Date | string | null | undefined,
  at: Date,
): IsoDate | null {
  if (!expiresAt) return null;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;
  if (expiry.getTime() < at.getTime()) return null;
  return vietnamDate(expiry);
}

/**
 * Parse a supplier's free-text validity into whole days. MicroEsim sends
 * `validity_period` as text ("180", "180 days", "180天"), so the number is pulled
 * out rather than trusted to be numeric; anything without a number means the
 * supplier did not state it.
 */
export function parseValidityDays(
  raw: string | number | null | undefined,
): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  }
  const match = /(\d+(?:\.\d+)?)/.exec(raw);
  if (!match) return null;
  const days = Math.round(Number(match[1]));
  return days > 0 ? days : null;
}

/**
 * The earlier of a rolling deadline ("today + N days") and a fixed date the
 * supplier states (#047, test round 4). A fixed date already past is ignored.
 */
export function earliestActivationDeadline(
  fromDays: IsoDate | null,
  validUntil: Date | string | null | undefined,
  now: Date,
): IsoDate | null {
  const until = validUntil ? new Date(validUntil) : null;
  const fixed =
    until && !Number.isNaN(until.getTime()) && until.getTime() > now.getTime()
      ? vietnamDate(until)
      : null;
  if (fromDays && fixed) return fromDays < fixed ? fromDays : fixed;
  return fromDays ?? fixed;
}
