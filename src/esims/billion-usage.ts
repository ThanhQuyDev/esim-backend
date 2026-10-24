import type { BillionUsageSubOrder } from '../esim-providers/billion/billion-api.types';

/** "2026-10-19 18:44:49" in Billion's clock (UTC+8, docs §2.1.2) → ISO. */
export function billionTimeToIso(
  value: string | null | undefined,
): string | null {
  const m = (value ?? '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const PLAN_STATUS: Record<string, string> = {
  '0': 'NOT_ACTIVE',
  '1': 'ACTIVE',
  '2': 'FINISHED',
  '3': 'CANCELLED',
};

/**
 * One Billion F046 sub-order as the usage our pages draw (vande #004).
 *
 * - Times are Billion's UTC+8 wall clock; `new Date()` read them as UTC and
 *   put activation and expiry 8 hours late.
 * - A daily plan ("1GB/day, then slow") reports `totalTraffic: -1` and its
 *   high-speed allowance per day in `highFlowSize` (KB). Read as "-1 =
 *   unlimited", the page showed no bar at all; the high-speed total is the
 *   daily allowance times the days.
 * - `planStartTime` is when the plan started on the network — the activation.
 */
export function billionUsageResult(sub: BillionUsageSubOrder | undefined): {
  remaining: number | null;
  total: number;
  dataUsed: number;
  expiredAt: string | null;
  isUnlimited: boolean;
  status: string;
  lastUpdateTime: string | null;
  activatedAt: string | null;
  durationDays: number | null;
} {
  const usedKb = (sub?.usageInfoList ?? []).reduce(
    (sum, u) => sum + (parseFloat(u.usageAmt ?? u.useageAmt ?? '0') || 0),
    0,
  );
  const totalTrafficKb = parseFloat(sub?.totalTraffic ?? '');
  const highFlowKb = parseFloat(sub?.highFlowSize ?? '');
  const days = parseInt(sub?.totalDays ?? '', 10);
  const daily = sub?.planType === '1';

  let totalKb = 0;
  if (Number.isFinite(totalTrafficKb) && totalTrafficKb > 0) {
    totalKb = totalTrafficKb;
  } else if (Number.isFinite(highFlowKb) && highFlowKb > 0) {
    totalKb = daily && days > 0 ? highFlowKb * days : highFlowKb;
  }
  const isUnlimited = totalKb <= 0 && totalTrafficKb === -1;
  const totalMb = totalKb / 1024;
  const dataUsedMb = usedKb / 1024;

  return {
    remaining:
      isUnlimited || totalMb <= 0 ? null : Math.max(totalMb - dataUsedMb, 0),
    total: totalMb,
    dataUsed: dataUsedMb,
    expiredAt: billionTimeToIso(sub?.planEndTime),
    isUnlimited,
    status: PLAN_STATUS[sub?.planStatus ?? ''] ?? 'UNKNOWN',
    lastUpdateTime: null,
    activatedAt: billionTimeToIso(sub?.planStartTime),
    durationDays: days > 0 ? days : null,
  };
}
