/**
 * "Giờ làm mới mỗi ngày" — when a plan's daily data allowance starts over
 * (#063, display copy in #071).
 *
 * Two distinct things can happen at the end of a "day" and customers ask about
 * both, because the answer changes when their allowance comes back:
 *
 *  - a rolling 24-hour cycle counted from the moment the eSIM is installed, so
 *    the reset moment differs for every customer;
 *  - a calendar day in a timezone the supplier fixes, so the allowance comes
 *    back at 23:59 there no matter where the device is.
 *
 * The offset is stored alongside the policy because it is not the same for every
 * supplier: Viettel and the domestic eSIMs run on UTC+7, the Chinese suppliers on
 * UTC+8. Hard-coding one of them into the storefront copy would misinform half
 * the catalogue.
 */
export enum DailyResetPolicyEnum {
  /** 24 hours counted from installation. */
  Rolling24h = 'rolling_24h',
  /** The supplier's own calendar day, ending 23:59 at `dailyResetUtcOffset`. */
  CalendarDay = 'calendar_day',
}

export const DAILY_RESET_POLICIES = [
  DailyResetPolicyEnum.Rolling24h,
  DailyResetPolicyEnum.CalendarDay,
] as const;

/** Viettel and the domestic eSIMs are sold and counted in Vietnam time. */
export const VIETNAM_UTC_OFFSET = 7;

/** The Chinese suppliers (Billion, MicroEsim) count their day in UTC+8. */
export const CHINA_UTC_OFFSET = 8;

export type DailyReset = {
  dailyResetPolicy: DailyResetPolicyEnum;
  /** Hours east of UTC; only meaningful for `CalendarDay`. */
  dailyResetUtcOffset: number | null;
};

/**
 * What a supplier's plans reset by, where that is a fixed fact about the
 * supplier rather than something the API tells us per plan (#071):
 *
 *  - GadgetKorea publishes "reset 24h" in its Initialize policy column;
 *  - esimaccess and airalo expose nothing, but both confirmed 24h when asked;
 *  - Viettel and the domestic eSIMs reset on the Vietnamese calendar day.
 *
 * Billion and MicroEsim are deliberately absent: they send the cycle per plan
 * (see `billionDailyReset` / `microEsimDailyReset`), so a blanket default here
 * would overwrite the real answer on every sync.
 */
export function defaultDailyReset(
  provider: string | null | undefined,
  isLocalInventory = false,
): DailyReset | null {
  if (isLocalInventory) {
    return {
      dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
      dailyResetUtcOffset: VIETNAM_UTC_OFFSET,
    };
  }

  switch ((provider ?? '').toLowerCase()) {
    case 'viettel':
      return {
        dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
        dailyResetUtcOffset: VIETNAM_UTC_OFFSET,
      };
    case 'gadgetkorea':
    case 'esimaccess':
    case 'airalo':
      return {
        dailyResetPolicy: DailyResetPolicyEnum.Rolling24h,
        dailyResetUtcOffset: null,
      };
    default:
      return null;
  }
}

/**
 * Read a supplier's own wording for the reset cycle, e.g. the GadgetKorea
 * "Initialize policy" column (#071).
 *
 * Only wording that is unmistakable is recognised. Anything else returns null so
 * the caller falls back to the supplier default, because this feeds a sentence
 * telling a customer when their data comes back — a wrong guess there is worse
 * than saying nothing.
 */
export function parseDailyResetPolicy(
  raw: string | null | undefined,
): DailyResetPolicyEnum | null {
  if (!raw) return null;
  const text = raw.toLowerCase();

  // "reset 24h", "24 hours", "every 24 hour", "24 giờ".
  // The unit is closed with a negative lookahead rather than `\b`, because `\b`
  // is defined on ASCII word characters and so never matches after "giờ".
  if (/\b24\s*(?:hours?|hrs?|h|giờ|gio)(?![a-z])/.test(text)) {
    return DailyResetPolicyEnum.Rolling24h;
  }
  // "calendar day", "natural day", "midnight", "00:00", "23:59"
  if (
    /calendar\s*day|natural\s*day|midnight|00:00|23:59|ngày\s*tự\s*nhiên/.test(
      text,
    )
  ) {
    return DailyResetPolicyEnum.CalendarDay;
  }
  return null;
}

/** "UTC+8", "UTC-8", "UTC+5:30" → hours east of UTC, or null. */
function utcOffsetHours(text: string | null | undefined): number | null {
  const m = (text ?? '').match(/UTC\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i);
  if (!m) return null;
  const hours = Number(m[2]) + Number(m[3] ?? 0) / 60;
  return Math.round((m[1] === '-' ? -hours : hours) * 100) / 100;
}

/**
 * MicroEsim states the cycle per plan in `usage_reset` (vande #033):
 * "24Hrs" for a rolling day, or the clock time the allowance comes back,
 * "0:00 (UTC+8)". A reset at another hour ("23:00 (UTC+9)") is the same thing
 * as midnight in the zone where that hour is 00:00, so it is stored that way
 * and the storefront sentence ("tính đến 23:59 (UTC+x)") stays true.
 */
export function microEsimDailyReset(
  usageReset: string | null | undefined,
): Partial<DailyReset> {
  const text = (usageReset ?? '').trim();
  if (!text) return {};
  if (/^24\s*h/i.test(text)) {
    return {
      dailyResetPolicy: DailyResetPolicyEnum.Rolling24h,
      dailyResetUtcOffset: null,
    };
  }
  const clock = text.match(/^(\d{1,2}):(\d{2})/);
  const offset = utcOffsetHours(text);
  if (!clock || offset == null) return {};
  const hour = Number(clock[1]) + Number(clock[2]) / 60;
  let midnightOffset = offset + (hour === 0 ? 0 : 24 - hour);
  if (midnightOffset > 14) midnightOffset -= 24;
  return {
    dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
    dailyResetUtcOffset: Math.round(midnightOffset),
  };
}

/**
 * Billion's daily plans come in two kinds (vande #033, read from F002 on
 * 25/10): "Natural Day" ones, whose description says "Natural Day means
 * 00:00-24:00 based on UTC+8 TimeZone" (or flag `highSpeedDataResetTimeType`
 * "2"), reset at midnight in the product's `timeZone`; the plain "1GB/day"
 * ones carry no such wording and run a 24-hour cycle. Plans with one total
 * allowance (`planType` "0") have no daily reset, so they get no keys.
 */
export function billionDailyReset(product: {
  name?: string | null;
  desc?: string | null;
  planType?: string | null;
  highSpeedDataResetTimeType?: string | null;
  timeZone?: string | null;
}): Partial<DailyReset> {
  if (product.planType !== '1') return {};
  const naturalDay =
    product.highSpeedDataResetTimeType === '2' ||
    /natural\s*day/i.test(`${product.name ?? ''} ${product.desc ?? ''}`);
  if (!naturalDay) {
    return {
      dailyResetPolicy: DailyResetPolicyEnum.Rolling24h,
      dailyResetUtcOffset: null,
    };
  }
  return {
    dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
    dailyResetUtcOffset: Math.round(
      utcOffsetHours(product.timeZone) ?? CHINA_UTC_OFFSET,
    ),
  };
}

/**
 * The same thing shaped for spreading into a sync payload. An unknown supplier
 * contributes no keys at all, so a value an admin filled in by hand survives the
 * next sync instead of being nulled out.
 */
export function defaultDailyResetFields(
  provider: string | null | undefined,
  isLocalInventory = false,
): Partial<DailyReset> {
  return defaultDailyReset(provider, isLocalInventory) ?? {};
}
