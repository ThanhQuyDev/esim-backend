/**
 * What a domestic (eSIM nội địa) plan includes beyond data — #066, test round 4.
 *
 * Domestic carriers sell plans with many perks that travel plans never have:
 * minutes split by network, a first-cycle data bonus, free social-media data,
 * and a renewal fee per cycle. They come from the domestic import template
 * (the red columns) and are shown on the carrier page so customers can compare.
 *
 * Stored as one JSON column on the plan: only domestic plans have it.
 */
export interface DomesticOffer {
  /** Data in the first cycle (MB; per day when `dataPeriod` is daily). Null = unlimited. */
  firstCycleDataMb: number | null;
  /** Data from the second cycle on — lower than the first on some promotions. Null = unlimited. */
  recurringDataMb: number | null;
  /** How data is counted: per day or per month. Calls/SMS/social are always per month. */
  dataPeriod: 'daily' | 'month';
  /** Daily / Month / Unlimited / Unlimited-reduce, as the carrier labels the plan. */
  bundleType: 'daily' | 'month' | 'unlimited' | 'unlimited-reduce';
  /** Minutes to other networks, per month. */
  offNetMinutes: number;
  /** Minutes within the same network, per month. */
  onNetMinutes: number;
  /** "Phút gọi trong nước": minutes to any network, as some carriers word it. */
  domesticMinutes: number;
  offNetSms: number;
  onNetSms: number;
  /** Social-media data does not count against the allowance. */
  zeroRatedSocial: boolean;
  /** Renewal fee for one cycle (VND). */
  cycleFeeVnd: number | null;
  /** How many days the plan runs before it must be renewed: 30, 180, 360 (vande-0411 #045). */
  cycleDays?: number;
  /** The same in months, on plans imported before; read as 30 days each. */
  cycleMonths?: number;
  /** E.g. "Đầu số 087" — the number range the eSIM comes with. */
  supportPhone: string | null;
}

const BUNDLE_TYPES: DomesticOffer['bundleType'][] = [
  'daily',
  'month',
  'unlimited',
  'unlimited-reduce',
];

/** "Daily" / "Month" / "Monthly" → the stored period; anything else reads as monthly. */
export function parseDataPeriod(
  raw: string | null,
): DomesticOffer['dataPeriod'] {
  return (raw ?? '').trim().toLowerCase().startsWith('da') ? 'daily' : 'month';
}

/** The carrier's bundle label, normalised; falls back to the data period. */
export function parseBundleType(
  raw: string | null,
  dataPeriod: DomesticOffer['dataPeriod'],
): DomesticOffer['bundleType'] {
  const value = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/^monthly$/, 'month');
  return (BUNDLE_TYPES as string[]).includes(value)
    ? (value as DomesticOffer['bundleType'])
    : dataPeriod;
}

/** "3 GB" → 3072, "500 MB" → 500, "Unlimited"/blank → null. */
export function parseOfferDataMb(raw: string | null): number | null {
  const match = (raw ?? '').toLowerCase().match(/([\d.,]+)\s*(gb|mb)/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  return match[2] === 'gb' ? Math.round(num * 1024) : Math.round(num);
}

/**
 * "No. of Cycles" is in days now: 30, 180, 360. A file made before says 1, 3, 6
 * or 12, which no plan means in days, so those still read as months
 * (vande-0411 #045).
 */
export function cycleDaysFromCell(raw: unknown): number {
  const n = offerCount(raw);
  if (n === 0) return 30;
  return [1, 2, 3, 6, 12].includes(n) ? n * 30 : n;
}

/** A whole number from a cell; blank or text reads as 0. */
export function offerCount(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
