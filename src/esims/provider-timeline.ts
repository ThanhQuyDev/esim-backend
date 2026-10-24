import type { BillionProfileStatus } from '../esim-providers/billion/billion-api.types';

/**
 * The moments of an eSIM's life the suppliers report (vande #011): added to a
 * phone (installed), the phone's EID and model. Activation, expiry and usage
 * come with the usage figures; these come from separate calls, made only while
 * something is still missing.
 */
export interface EsimTimelineFacts {
  installedAt?: string | null;
  activatedAt?: string | null;
  expiredAt?: string | null;
  eid?: string | null;
  deviceModel?: string | null;
}

/**
 * "2026-10-20 10:18:27" on a supplier's UTC+8 clock → ISO. Billion and
 * MicroEsim both keep UTC+8 (MicroEsim's create_time 09:39:05 for an order we
 * created at 01:39:03 UTC); read as UTC the moments came out 8 hours late.
 */
export function utc8ToIso(value: string | null | undefined): string | null {
  const m = (value ?? '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** eSIM Access writes "2026-10-23T12:15:54+0000"; JS wants "+00:00". */
export function esimAccessTimeToIso(
  value: string | null | undefined,
): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  const date = new Date(v.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** eSIM Access `/esim/query` item, the fields #011 reads. */
export interface EsimAccessEsimFacts {
  iccid?: string;
  eid?: string;
  installationTime?: string;
  activateTime?: string;
  expiredTime?: string;
}

export function esimAccessTimeline(
  item: EsimAccessEsimFacts | undefined,
): EsimTimelineFacts {
  if (!item) return {};
  return {
    installedAt: esimAccessTimeToIso(item.installationTime),
    activatedAt: esimAccessTimeToIso(item.activateTime),
    expiredAt: esimAccessTimeToIso(item.expiredTime),
    eid: item.eid?.trim() || null,
  };
}

/**
 * Billion F042 history. Status 1 = downloaded, 2 = installed: the earliest of
 * those is when the eSIM reached the phone; 3 (enabled) / 4 (disabled) come
 * after. The EID is on every row.
 */
export function billionTimeline(
  rows: BillionProfileStatus[] | null | undefined,
): EsimTimelineFacts {
  const list = rows ?? [];
  const added = list
    .filter((r) => ['1', '2'].includes(String(r.status)))
    .map((r) => utc8ToIso(r.recordTime))
    .filter((t): t is string => !!t)
    .sort();
  return {
    installedAt: added[0] ?? null,
    eid: list.find((r) => r.eid?.trim())?.eid?.trim() ?? null,
  };
}

/** MicroEsim `/allesim/v1/eventDetail` event. */
export interface MicroEsimEvent {
  event_date?: string;
  eid?: string;
  device_model?: string;
  notify_type?: string;
}

/**
 * MicroEsim events only exist once the profile reached a phone, so the
 * earliest of them is the install moment ("ENABLED" when there is one, as its
 * support advised). EID and model come from the latest event.
 */
export function microEsimTimeline(
  events: MicroEsimEvent[] | null | undefined,
): EsimTimelineFacts {
  const list = [...(events ?? [])].sort((a, b) =>
    String(a.event_date ?? '').localeCompare(String(b.event_date ?? '')),
  );
  if (list.length === 0) return {};
  const enabled = list.find(
    (e) => (e.notify_type ?? '').toUpperCase() === 'ENABLED',
  );
  const latest = [...list].reverse();
  return {
    installedAt: utc8ToIso((enabled ?? list[0]).event_date),
    eid: latest.find((e) => e.eid?.trim())?.eid?.trim() ?? null,
    deviceModel:
      latest.find((e) => e.device_model?.trim())?.device_model?.trim() ?? null,
  };
}

/** "68.02 MB" / "1.5 GB" / "512 KB" → MB. */
export function sizeToMb(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const m = String(value ?? '')
    .trim()
    .match(/^([\d.]+)\s*(kb|mb|gb)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? 'mb').toLowerCase();
  return unit === 'gb' ? n * 1024 : unit === 'kb' ? n / 1024 : n;
}
