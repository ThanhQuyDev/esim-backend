/**
 * One naming rule for every plan, whichever supplier it comes from (vande #020).
 *
 * Suppliers name plans their own way ("Afghanistan 10GB / 30day", "Asia 13 1GB
 * per day", "China-SGIP-1GB"…), so telling what a plan offers meant reading
 * the days, data and throttling columns beside it, and the name a customer saw
 * on their order was the supplier's. The rule:
 *
 *   Country / region - data - minutes & SMS (if any) - days
 *
 *   Vietnam - Total 5 GB - 7 days
 *   Vietnam - Total 5 GB - Unlimited 1 Mbps - 7 days
 *   Vietnam - Daily 5 GB/day - 200 Mins - 200 SMS - 7 days
 *   Vietnam - Unlimited 5 Mbps - 7 days
 *   Global 45 - Unlimited - 7 days
 *
 * "Unlimited" is only for a speed still worth using, 1 Mbps or more: "Japan -
 * Total 10 GB - Unlimited 128 Kbps" read as unlimited to a customer who would
 * crawl at 128 Kbps, so it is "Japan - Total 10 GB - 7 days" (vande-0411 #038).
 *
 * The supplier's own name stays in `plan.name`; plans we stock ourselves are
 * imported with a name already in this form, so theirs is kept as it is.
 */
export interface StandardNameInput {
  type?: string | null;
  dataMb?: number | null;
  durationDays?: number | null;
  /** Speed after the high-speed data is used up ("1 Mbps", "384kbps"…). */
  fupSpeed?: string | null;
  call?: number | null;
  sms?: number | null;
  name?: string | null;
  /**
   * A day pass sold for the days the customer picks: its stored length (1 day)
   * is not what they buy, so the name leaves the days out.
   */
  isAbleMultidate?: boolean | null;
  /** Our own stock (Viettel, eSIM nội địa): its imported name is the standard. */
  isLocalInventory?: boolean | null;
}

/** "384kbps" → "384 Kbps", "1Mbps" → "1 Mbps"; anything else (Terminate) → null. */
export function formatSpeed(raw: string | null | undefined): string | null {
  const match = String(raw ?? '').match(/([\d.]+)\s*([km])bps/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!(value > 0)) return null;
  return `${value} ${match[2].toLowerCase() === 'k' ? 'Kbps' : 'Mbps'}`;
}

/** 5120 → "5 GB", 500 → "500 MB", 1536 → "1.5 GB". */
export function formatData(dataMb: number): string {
  if (dataMb >= 1024) {
    const gb = Math.round((dataMb / 1024) * 100) / 100;
    return `${gb} GB`;
  }
  return `${Math.round(dataMb)} MB`;
}

const DAILY_TYPES = new Set(['daily', 'daily-limit-service-cutoff']);

/** "Unlimited 5 Mbps" from 1 Mbps up; nothing to say below that. */
function unlimitedLabel(raw: string | null | undefined): string | null {
  const speed = formatSpeed(raw);
  if (!speed) return null;
  const [value, unit] = speed.split(' ');
  const mbps = unit === 'Mbps' ? Number(value) : Number(value) / 1024;
  return mbps >= 1 ? `Unlimited ${speed}` : null;
}

export function standardPlanName(
  plan: StandardNameInput,
  locationName: string | null | undefined,
): string {
  if (plan.isLocalInventory && plan.name?.trim()) return plan.name.trim();

  const type = plan.type ?? '';
  const dataMb = Number(plan.dataMb ?? 0);
  const unlimited = unlimitedLabel(plan.fupSpeed);
  const parts: string[] = [locationName?.trim() || 'eSIM'];

  if (
    DAILY_TYPES.has(type) ||
    ((type === 'unlimited' || type === 'unlimited-reduce') && dataMb > 0)
  ) {
    // A day pass: so much data a day, then (maybe) slower but unlimited. An
    // "unlimited" plan with a quota is one too, as Billion and MicroEsim file
    // "1GB/day, then 5 Mbps"; a total quota stays "fixed" (vande-0411 #038).
    parts.push(`Daily ${formatData(dataMb)}/day`);
    if (unlimited) parts.push(unlimited);
  } else if (type === 'unlimited' || type === 'unlimited-reduce') {
    // No quota to name, so the speed is all there is, however low: a bare
    // "Unlimited" would promise more than "Unlimited 128 Kbps" does.
    const speed = formatSpeed(plan.fupSpeed);
    parts.push(speed ? `Unlimited ${speed}` : 'Unlimited');
  } else {
    parts.push(`Total ${formatData(dataMb)}`);
    if (unlimited) parts.push(unlimited);
  }

  if (Number(plan.call) > 0) parts.push(`${Number(plan.call)} Mins`);
  if (Number(plan.sms) > 0) parts.push(`${Number(plan.sms)} SMS`);

  const days = plan.isAbleMultidate ? 0 : Number(plan.durationDays ?? 0);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);

  return parts.join(' - ');
}
