import { BillionPrice, BillionProduct } from './billion-api.types';

/**
 * Pure mapping from the BILLION catalogue (F002 products + F003 prices) to our
 * plan rows. Kept free of Nest dependencies so it can be tested on real
 * catalogue samples.
 *
 * What the fields actually mean (checked against the live catalogue):
 * - `type` 3105 = "self-selected": ONE skuId is sold for many durations. F003
 *   has one price row per duration, with `copies === days`, and the prices are
 *   not linear (Korea 3GB/day: 1 day = 6, 5 days = 23). `product.days` is just
 *   the unit ("1"). Each price row therefore becomes its own plan, ordered with
 *   `planSkuCopies = copies`.
 * - `type` 3106 / 230 = fixed duration: `product.days` is the validity and
 *   F003 has a single `copies = 1` row.
 * - `planType` '0' = total quota, '1' = per-day quota. The quota is in
 *   `highFlowSize` (KB); `capacity` is usually -1. `-1` means unlimited.
 * - `limitFlowSpeed` (kbps) is the speed after the quota; 0 = cut off.
 * - "eSIM Carrier of 90 days" in the name is the window to activate the eSIM,
 *   NOT the plan duration.
 */

export interface BillionPlanVariant {
  /** `skuId`, or `skuId:copies` when the order must buy several copies. */
  providerPlanId: string;
  copies: number;
  durationDays: number;
  /** Settlement price of this duration, in the provider's currency. */
  cost: number;
  type: string;
  dataMb: number;
  fupSpeed: string | null;
  name: string;
}

/** Plan id stored on our `plan` row for one BILLION sku + copies. */
export function encodeBillionPlanId(skuId: string, copies: number): string {
  return copies > 1 ? `${skuId}:${copies}` : skuId;
}

/**
 * Split a stored BILLION `providerPlanId` back into the skuId and the number of
 * copies F040/F007 must order. Plans synced before copies were encoded are a
 * bare skuId, i.e. one copy.
 */
export function parseBillionPlanId(providerPlanId: string): {
  skuId: string;
  copies: number;
} {
  const [skuId, rawCopies] = providerPlanId.split(':');
  const copies = parseInt(rawCopies ?? '1', 10);
  return { skuId, copies: copies > 0 ? copies : 1 };
}

const num = (value: string | undefined): number => {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
};

function formatSpeed(kbps: number): string {
  if (kbps < 1024) return `${kbps}kbps`;
  return `${Math.round((kbps / 1024) * 10) / 10}Mbps`;
}

/**
 * Type of an unlimited plan from its usable speed, per the customer's rule
 * (#002, test round 4): above 1 Mbps it is "unlimited"; exactly 1 Mbps is
 * "unlimited-reduce" (unlimited at low speed); below that the speed is a crawl,
 * so a daily quota plan reads as "daily".
 */
export function unlimitedTypeForSpeed(kbps: number): string {
  if (kbps > 1024) return 'unlimited';
  if (kbps === 1024) return 'unlimited-reduce';
  return 'daily';
}

/**
 * Daily quota and after-quota speed spelled out in a product name, for the
 * products whose F002 fields say -1 ("unlimited") although the plan has a
 * daily high-speed quota: "Global21-1GB/day,throttled 5mbps",
 * "China Mainland-China Mobile-1GB/Natural day-throttle to 5Mbps",
 * "USA-throttled 10mbps/day" (speed only, no quota).
 */
export function billionNameAllowance(name: string): {
  quotaMb: number | null;
  throttleKbps: number | null;
} {
  const quota = name.match(
    /(\d+(?:\.\d+)?)\s*(GB|MB)\s*\/\s*(?:natural\s*)?day/i,
  );
  const speed = name.match(
    /throttle(?:d)?(?:\s+to)?\s*(\d+(?:\.\d+)?)\s*(mbps|kbps)/i,
  );
  const quotaMb = quota
    ? Math.round(parseFloat(quota[1]) * (/gb/i.test(quota[2]) ? 1024 : 1))
    : null;
  const throttleKbps = speed
    ? Math.round(parseFloat(speed[1]) * (/mbps/i.test(speed[2]) ? 1024 : 1))
    : null;
  return { quotaMb, throttleKbps };
}

/**
 * After-quota speed written right after the data in a fixed plan's name:
 * "China-SGIP-1GB,384kbps", "China Mainland(Multi)-1GB,128kbps". Null when the
 * name states none.
 */
export function billionFixedNameSpeed(name: string): number | null {
  const match = name.match(
    /\d+(?:\.\d+)?\s*(?:GB|MB)\s*,\s*(\d+(?:\.\d+)?)\s*(kbps|mbps)/i,
  );
  if (!match) return null;
  return Math.round(parseFloat(match[1]) * (/mbps/i.test(match[2]) ? 1024 : 1));
}

/** Plan `type`, data allowance and after-quota speed of a product. */
export function billionDataAndType(product: BillionProduct): {
  type: string;
  dataMb: number;
  fupSpeed: string | null;
} {
  let quotaKb = num(product.highFlowSize);
  const capacityKb = num(product.capacity);
  let throttleKbps = num(product.limitFlowSpeed);

  if (product.planType === '1') {
    // F002 says -1 for both on dozens of "1GB/day, throttled 5Mbps" products;
    // the name is then the only place the real quota and speed are written.
    const fromName = billionNameAllowance(product.name);
    if (quotaKb < 0 && fromName.quotaMb) quotaKb = fromName.quotaMb * 1024;
    if (throttleKbps < 0 && fromName.throttleKbps) {
      throttleKbps = fromName.throttleKbps;
    }

    // Unlimited at every speed ("Mexico-Unlimited/day").
    if (quotaKb < 0 && throttleKbps < 0) {
      return { type: 'unlimited', dataMb: 0, fupSpeed: null };
    }
    // No daily quota, only a speed cap ("USA-throttled 10mbps/day"): unlimited
    // at that speed, shown as "Không giới hạn 10Mbps".
    if (quotaKb <= 0) {
      return {
        type: throttleKbps > 1024 ? 'unlimited' : 'unlimited-reduce',
        dataMb: 0,
        fupSpeed: throttleKbps > 0 ? formatSpeed(throttleKbps) : null,
      };
    }
    // A daily high-speed quota, then the after-quota speed decides the type.
    // The quota stays the plan's data ("1GB"), whatever the type.
    return {
      type: throttleKbps > 0 ? unlimitedTypeForSpeed(throttleKbps) : 'daily',
      dataMb: Math.round(quotaKb / 1024),
      fupSpeed: throttleKbps > 0 ? formatSpeed(throttleKbps) : null,
    };
  }

  // The name states the after-quota speed of a fixed plan ("China Mainland
  // (Multi)-1GB,128kbps") and F002 can contradict it — 384 for that product. The
  // name is what the customer reads, so it wins (#046, test round 4).
  const named = billionFixedNameSpeed(product.name);
  if (named) throttleKbps = named;
  const fupSpeed = throttleKbps > 0 ? formatSpeed(throttleKbps) : null;
  const totalKb = capacityKb > 0 ? capacityKb : quotaKb;
  if (totalKb > 0) {
    return { type: 'fixed', dataMb: Math.round(totalKb / 1024), fupSpeed };
  }
  return { type: 'unlimited', dataMb: 0, fupSpeed: null };
}

/** Product name without the "eSIM Carrier of N days" activation-window noise. */
export function cleanBillionName(name: string): string {
  return name
    .replace(/[\s+-]*eSIM Carrier(?: of \d+ days)?[\s+]*/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s+-]+|[\s+-]+$/g, '');
}

/**
 * Display name for a multi-country region: the location part of the product
 * name ("Global 67 Destinations-Fixed 30GB-…" → "Global 67 Destinations"),
 * falling back to the country names.
 */
export function billionRegionName(product: BillionProduct): string {
  const location = cleanBillionName(product.name)
    .split('-')[0]
    .replace(/\s*\d+(?:\.\d+)?\s*(?:GB|MB)\b.*$/i, '')
    .trim();
  // Some names start with the plan kind instead ("Daily 1GB-…").
  if (location && !/^(?:daily|fixed|unlimited)$/i.test(location)) {
    return location;
  }
  return (product.country ?? [])
    .map((c) => c.name)
    .filter(Boolean)
    .join(', ');
}

/** A region name the sync generated from a raw product name (not CMS-edited). */
export function isRawBillionRegionName(name: string): boolean {
  return /eSIM Carrier/i.test(name) || /\d\s*(?:GB|MB)\b/i.test(name);
}

/** Every plan row one product yields — one per sellable duration. */
export function billionPlanVariants(
  product: BillionProduct,
  price: BillionPrice | undefined,
): BillionPlanVariant[] {
  const rows = price?.price ?? [];
  const { type, dataMb, fupSpeed } = billionDataAndType(product);
  const baseName = cleanBillionName(product.name) || product.name.trim();

  if (product.type === '3105') {
    const variants: BillionPlanVariant[] = [];
    const seen = new Set<number>();
    for (const row of rows) {
      const copies = parseInt(row.copies, 10);
      const days = parseInt(row.days ?? row.copies, 10);
      const cost = parseFloat(row.settlementPrice);
      if (!(copies > 0) || !(days > 0) || !Number.isFinite(cost)) continue;
      if (seen.has(copies)) continue;
      seen.add(copies);
      variants.push({
        providerPlanId: encodeBillionPlanId(product.skuId, copies),
        copies,
        durationDays: days,
        cost,
        type,
        dataMb,
        fupSpeed,
        name: `${baseName} - ${days} ${days === 1 ? 'day' : 'days'}`,
      });
    }
    return variants;
  }

  const single = rows.find((row) => row.copies === '1') ?? rows[0];
  const cost = single ? parseFloat(single.settlementPrice) : NaN;
  if (!Number.isFinite(cost)) return [];
  const days = parseInt(product.days ?? single.days ?? '0', 10) || 0;
  return [
    {
      providerPlanId: product.skuId,
      copies: 1,
      durationDays: days,
      cost,
      type,
      dataMb,
      fupSpeed,
      name: baseName,
    },
  ];
}

/**
 * The "activate before" moment Billion states in `validityPeriod`
 * ("2028-07-22 23:59:59", in the product's `timeZone`, "UTC+8"), as a Date
 * (#047, test round 4). Null when the product states none — most do not.
 */
export function billionActivationUntil(
  validityPeriod: string | null | undefined,
  timeZone: string | null | undefined,
): Date | null {
  const match = (validityPeriod ?? '').match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) return null;
  const offset = (timeZone ?? '').match(
    /UTC\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i,
  );
  const offsetMinutes = offset
    ? (offset[1] === '-' ? -1 : 1) *
      (Number(offset[2]) * 60 + Number(offset[3] ?? 0))
    : 8 * 60; // Billion's dates are China time when unstated.
  const [, y, mo, d, h = '23', mi = '59', sec = '59'] = match;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec) - offsetMinutes * 60000;
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}
