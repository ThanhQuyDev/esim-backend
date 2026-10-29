/**
 * "Khoảng thời gian" of a customer announcement (vande #072): which stretch
 * of time the customer group is read over. Days and weeks are Vietnamese
 * ones — "tuần trước" is Monday to Sunday in Vietnam, not in UTC.
 */
export const ANNOUNCEMENT_PERIODS = [
  'last_7_days',
  'last_14_days',
  'last_30_days',
  'last_week',
  'last_month',
  'last_60_days',
  'last_90_days',
  'last_6_months',
  'last_12_months',
  'all_time',
] as const;
export type AnnouncementPeriod = (typeof ANNOUNCEMENT_PERIODS)[number];

/**
 * "Nhóm khách hàng":
 * - `new` — signed up (by OTP or a password) and never ordered: no order that
 *   went through and none that failed;
 * - `purchased` — at least one order that went through;
 * - `failed` — an order that failed, and none that ever went through. A
 *   customer with both counts as `purchased`.
 */
export const ANNOUNCEMENT_AUDIENCES = ['new', 'purchased', 'failed'] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

/**
 * Who an announcement is sent to: one of the groups above, or `emails` — the
 * addresses the admin typed in, whatever group they are in or even without an
 * account (vande #087).
 */
export const ANNOUNCEMENT_TARGETS = [
  ...ANNOUNCEMENT_AUDIENCES,
  'emails',
] as const;
export type AnnouncementTarget = (typeof ANNOUNCEMENT_TARGETS)[number];

/** Most addresses one announcement may be typed in with. */
export const MAX_ANNOUNCEMENT_EMAILS = 1000;

/** The typed-in addresses, trimmed, lower-cased and each only once. */
export function normalizeAnnouncementEmails(
  emails: readonly string[],
): string[] {
  return [
    ...new Set(
      emails.map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0),
    ),
  ];
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A Vietnamese wall-clock moment as the real instant it is. */
function vnWallToInstant(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - VN_OFFSET_MS);
}

/**
 * The window as real instants: `from` inclusive, `to` exclusive; null for an
 * open end. `all_time` has neither.
 */
export function announcementWindow(
  period: AnnouncementPeriod,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  const days = (n: number) => ({
    from: new Date(now.getTime() - n * DAY_MS),
    to: null,
  });
  // Today's date in Vietnam, as its parts.
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const y = vn.getUTCFullYear();
  const m = vn.getUTCMonth();
  const d = vn.getUTCDate();

  switch (period) {
    case 'last_7_days':
      return days(7);
    case 'last_14_days':
      return days(14);
    case 'last_30_days':
      return days(30);
    case 'last_60_days':
      return days(60);
    case 'last_90_days':
      return days(90);
    case 'last_6_months':
    case 'last_12_months': {
      const back = period === 'last_6_months' ? 6 : 12;
      const from = new Date(now);
      from.setUTCMonth(from.getUTCMonth() - back);
      return { from, to: null };
    }
    case 'last_week': {
      // Monday of this week in Vietnam (getUTCDay: 0 = Sunday).
      const sinceMonday = (vn.getUTCDay() + 6) % 7;
      const thisMonday = vnWallToInstant(y, m, d - sinceMonday);
      return {
        from: new Date(thisMonday.getTime() - 7 * DAY_MS),
        to: thisMonday,
      };
    }
    case 'last_month':
      return {
        from: vnWallToInstant(y, m - 1, 1),
        to: vnWallToInstant(y, m, 1),
      };
    case 'all_time':
    default:
      return { from: null, to: null };
  }
}
