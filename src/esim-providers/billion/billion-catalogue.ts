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

/** Plan `type`, data allowance and after-quota speed of a product. */
export function billionDataAndType(product: BillionProduct): {
  type: string;
  dataMb: number;
  fupSpeed: string | null;
} {
  const quotaKb = num(product.highFlowSize);
  const capacityKb = num(product.capacity);
  const throttleKbps = num(product.limitFlowSpeed);
  const fupSpeed = throttleKbps > 0 ? formatSpeed(throttleKbps) : null;

  if (quotaKb < 0 || throttleKbps < 0) {
    return { type: 'unlimited', dataMb: 0, fupSpeed: null };
  }

  if (product.planType === '1') {
    // No daily high-speed quota, only a speed cap: unlimited at that speed.
    if (quotaKb === 0) return { type: 'unlimited', dataMb: 0, fupSpeed };
    // Same split as eSIM Access: usable speed after the daily quota reads as
    // "unlimited", a crawl or cut-off reads as a daily plan.
    return {
      type: throttleKbps >= 1024 ? 'unlimited-reduce' : 'daily',
      dataMb: Math.round(quotaKb / 1024),
      fupSpeed,
    };
  }

  const totalKb = capacityKb > 0 ? capacityKb : quotaKb;
  if (totalKb > 0) {
    return { type: 'fixed', dataMb: Math.round(totalKb / 1024), fupSpeed };
  }
  return {
    type: throttleKbps > 0 ? 'unlimited-reduce' : 'unlimited',
    dataMb: 0,
    fupSpeed,
  };
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
