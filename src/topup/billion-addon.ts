import type {
  BillionAccelerationDayType,
  BillionAccelerationSku,
} from '../esim-providers/billion/billion-api.types';

/**
 * "Mua thêm dung lượng" for Billion eSIMs (vande #081): Billion's acceleration
 * packages (加速包), listed per eSIM by F015 and bought by F016. They add to the
 * plan the eSIM already has; a top-up (F007) is a plan of its own.
 */

/** Package ids of acceleration packages: `billion-acc:<dayType>:<skuId>:<copies>`. */
export const BILLION_ADDON_PACKAGE_PREFIX = 'billion-acc:';

export const BILLION_ADDON_DAY_TYPES: readonly BillionAccelerationDayType[] = [
  '0',
  '1',
  '2',
];

/** What each dayType does, as the shop and the CMS call it. */
export const BILLION_ADDON_LABEL: Record<BillionAccelerationDayType, string> = {
  '0': 'Tăng tốc 1 ngày',
  '1': 'Nâng cấp gói',
  '2': 'Thêm dung lượng',
};

/** Same, for the storefront: `boost` / `upgrade` / `extra`. */
export const BILLION_ADDON_KIND: Record<
  BillionAccelerationDayType,
  'boost' | 'upgrade' | 'extra'
> = { '0': 'boost', '1': 'upgrade', '2': 'extra' };

/** Billion: `accelerationSupport` 2 (eSIM) or 3 (both) — or not known yet. */
export function planTakesAddons(
  accelerationSupport: number | null | undefined,
): boolean {
  if (accelerationSupport === null || accelerationSupport === undefined) {
    return true;
  }
  return accelerationSupport === 2 || accelerationSupport === 3;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many copies F016 must order. A one-day boost is 1. An upgrade or extra
 * data covers the rest of the plan: "original days − days used + 1", where the
 * day of activation counts as day 1. Null once the plan has no day left.
 */
export function billionAddonCopies(params: {
  dayType: BillionAccelerationDayType;
  originalDays: number;
  activatedAt: Date;
  now?: Date;
}): number | null {
  if (params.dayType === '0') return 1;
  const now = params.now ?? new Date();
  const usedDays =
    Math.floor((now.getTime() - params.activatedAt.getTime()) / DAY_MS) + 1;
  const copies = Math.max(0, Math.round(params.originalDays)) - usedDays + 1;
  return copies >= 1 ? copies : null;
}

export function billionAddonPackageId(
  dayType: BillionAccelerationDayType,
  skuId: string,
  copies: number,
): string {
  return `${BILLION_ADDON_PACKAGE_PREFIX}${dayType}:${skuId}:${copies}`;
}

export function parseBillionAddonPackageId(packageId: string): {
  dayType: BillionAccelerationDayType;
  skuId: string;
  copies: number;
} | null {
  if (!packageId.startsWith(BILLION_ADDON_PACKAGE_PREFIX)) return null;
  const [dayType, skuId, copies] = packageId
    .slice(BILLION_ADDON_PACKAGE_PREFIX.length)
    .split(':');
  if (!['0', '1', '2'].includes(dayType) || !skuId || !/^\d+$/.test(copies)) {
    return null;
  }
  return {
    dayType: dayType as BillionAccelerationDayType,
    skuId,
    copies: Number(copies),
  };
}

/** Data the package gives, in bytes, and whether that is per day. */
export function billionAddonData(sku: BillionAccelerationSku): {
  bytes: number;
  perDay: boolean;
} {
  const perDay = sku.planType === '1' || (!sku.capacity && !!sku.highFlowSize);
  const kb = Number(perDay ? sku.highFlowSize : sku.capacity) || 0;
  return { bytes: Math.round(kb * 1024), perDay };
}
