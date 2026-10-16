/**
 * Airalo's refund request (doitac-1410 #079), `POST /v2/refund`:
 * https://developers.partners.airalo.com/request-refund-14583565e0
 *
 * A request is not a refund: Airalo's support reviews each one by hand, and an
 * approved one comes back as Airalo credit, not cash. At most 5 ICCIDs per
 * request; `notes` is required for `OTHERS`.
 */
export const AIRALO_REFUND_REASONS = [
  'INSTALLATION_FAILURE',
  'NO_COVERAGE',
  'APN_FAILURE',
  'TRIP_CANCELLATION',
  'INTERMITTENT_CONNECTION',
  'BLOCKED_NETWORK',
  'CHANGE_OF_PLAN',
  'DELETED_ESIM',
  'EARLY_EXPIRY',
  'HOTSPOT_NOT_WORKING',
  'IMSI_CHANGE',
  'INCOMPATIBLE_DEVICE',
  'LOCKED_DEVICE',
  'NO_VOICE_TEXT_SERVICES',
  'OVERCHARGED',
  'SLOW_SPEED',
  'TOP_UP_PACKAGE_FAILURE',
  'UNKNOWN_CHARGES',
  'WRONG_PURCHASE',
  'UNABLE_TO_ACCESS_APPS',
  'SERVICE_DEGRADATION',
  'QR_ISSUE_PARTNERS',
  'OTHERS',
] as const;

export type AiraloRefundReason = (typeof AIRALO_REFUND_REASONS)[number];

export const AIRALO_REFUND_MAX_ICCIDS = 5;
export const AIRALO_REFUND_NOTES_MAX = 255;

export interface AiraloRefundRequest {
  iccids: string[];
  reason: AiraloRefundReason;
  notes?: string;
  email?: string;
}

export interface AiraloRefundResult {
  refundId: string;
  createdAt: string | null;
  iccids: string[];
}

/** Lists of at most 5 ICCIDs, the most one request takes. */
export function chunkIccids(
  iccids: string[],
  size = AIRALO_REFUND_MAX_ICCIDS,
): string[][] {
  const unique = [...new Set(iccids.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}

/** The request body; `OTHERS` always carries a note, as Airalo requires. */
export function airaloRefundBody(req: AiraloRefundRequest) {
  const notes = (req.notes ?? '').trim().slice(0, AIRALO_REFUND_NOTES_MAX);
  return {
    iccids: req.iccids,
    reason: req.reason,
    ...(notes
      ? { notes }
      : req.reason === 'OTHERS'
        ? { notes: 'Refund requested by esim.vn' }
        : {}),
    ...(req.email ? { email: req.email } : {}),
  };
}

/**
 * Airalo answers 202 for its refusals too (ICCIDs not ours, a field
 * missing): only a `refund_id` means the request was taken.
 */
export function parseAiraloRefundResponse(
  body: unknown,
  iccids: string[],
): AiraloRefundResult {
  const data = (body as { data?: unknown })?.data as
    | { refund_id?: unknown; created_at?: unknown; reason?: unknown }
    | undefined;
  const refundId = data && !Array.isArray(data) ? data.refund_id : undefined;
  if (refundId === undefined || refundId === null || refundId === '') {
    const meta = (body as { meta?: { message?: unknown } })?.meta;
    const detail =
      data && !Array.isArray(data) && typeof data.reason === 'string'
        ? `: ${data.reason}`
        : '';
    throw new Error(
      `Airalo did not take the refund request — ${String(meta?.message ?? 'no refund_id')}${detail}`,
    );
  }
  return {
    refundId: String(refundId),
    createdAt: data?.created_at ? String(data.created_at) : null,
    iccids,
  };
}
