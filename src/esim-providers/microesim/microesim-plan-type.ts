import { unlimitedTypeForSpeed } from '../billion/billion-catalogue';

/**
 * A MicroEsim plan's type, data and after-quota speed (vande #012).
 *
 * MicroEsim spells the allowance out in `data`: "Daily1GB" (per day),
 * "Total20GB" (whole period), "Unlimited". `rule_desc` says what happens once
 * the high-speed data is used: "unlimited 128kbps" (slowed), "terminate"
 * (cut), "unlimited" (no cap). Only "unlimited" in `data` was recognised
 * before, so every Daily plan — 8 228 of 15 209 — was filed as "fixed".
 *
 * The types follow the customer's rule already applied to Billion (#002, test
 * round 4): a daily quota slowed to more than 1 Mbps is "unlimited", to exactly
 * 1 Mbps "unlimited-reduce", to less (or cut) "daily".
 */
export interface MicroEsimAllowance {
  type: string;
  dataMb: number;
  /** "128kbps", "10Mbps", "Terminate", or null when there is no cap. */
  fupSpeed: string | null;
}

function sizeMb(text: string): number {
  const m = text.toLowerCase().match(/([\d.]+)\s*(gb|mb)/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2] === 'gb' ? Math.round(n * 1024) : Math.round(n);
}

/** After-quota speed in kbps from `rule_desc`; -1 for "terminate", 0 for none. */
export function microEsimThrottleKbps(ruleDesc: string | null | undefined) {
  const rule = (ruleDesc ?? '').toLowerCase();
  if (/terminat/.test(rule)) return -1;
  const mbps = rule.match(/([\d.]+)\s*mbps/);
  if (mbps) return Math.round(parseFloat(mbps[1]) * 1024);
  const kbps = rule.match(/([\d.]+)\s*kbps/);
  if (kbps) return Math.round(parseFloat(kbps[1]));
  return 0;
}

function speedLabel(kbps: number): string | null {
  if (kbps < 0) return 'Terminate';
  if (kbps === 0) return null;
  if (kbps < 1024) return `${kbps}kbps`;
  return `${Math.round((kbps / 1024) * 10) / 10}Mbps`;
}

export function microEsimAllowance(item: {
  data?: string | null;
  rule_desc?: string | null;
  channel_dataplan_name?: string | null;
}): MicroEsimAllowance {
  const data = (item.data ?? '').trim();
  const name = item.channel_dataplan_name ?? '';
  const throttle = microEsimThrottleKbps(item.rule_desc);
  const fupSpeed = speedLabel(throttle);

  if (/^daily/i.test(data) || (!data && /-daily/i.test(name))) {
    const dataMb = sizeMb(data) || sizeMb(name);
    return {
      type: throttle > 0 ? unlimitedTypeForSpeed(throttle) : 'daily',
      dataMb,
      fupSpeed,
    };
  }

  if (/unlimited/i.test(data) || (!data && /-unlimited/i.test(name))) {
    // No quota at all: full speed, or unlimited at the stated speed.
    if (throttle <= 0) return { type: 'unlimited', dataMb: 0, fupSpeed: null };
    return {
      type: throttle > 1024 ? 'unlimited' : 'unlimited-reduce',
      dataMb: 0,
      fupSpeed,
    };
  }

  return {
    type: 'fixed',
    dataMb: sizeMb(data) || sizeMb(name),
    fupSpeed,
  };
}
