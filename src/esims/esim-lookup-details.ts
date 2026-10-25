import { DataSource } from 'typeorm';

/**
 * Minutes and SMS for the public lookup page (vande #037).
 *
 * Airalo's usage reply carries `total_voice` / `total_text` on every eSIM, and
 * on a voice plan it was answering 0 for both — so the plan's own 200 minutes /
 * 200 SMS were replaced by 0 and the page hid the row. A total of 0 is "not
 * reported": the plan's allowance is shown instead, with no bar, since a
 * remaining count measured against 0 means nothing either.
 */
export function lookupVoiceAndSms(
  usage: {
    voiceTotal?: number | null;
    voiceRemaining?: number | null;
    smsTotal?: number | null;
    smsRemaining?: number | null;
  },
  plan: { call?: number | null; sms?: number | null } | null | undefined,
): {
  callMinutes: number | null;
  callMinutesRemaining: number | null;
  smsCount: number | null;
  smsRemaining: number | null;
} {
  const reported = (total?: number | null) => !!total && total > 0;
  const allowance = (v?: number | null) => (v && v > 0 ? Number(v) : null);
  const voice = reported(usage.voiceTotal);
  const sms = reported(usage.smsTotal);
  return {
    callMinutes: voice ? Number(usage.voiceTotal) : allowance(plan?.call),
    callMinutesRemaining: voice ? (usage.voiceRemaining ?? null) : null,
    smsCount: sms ? Number(usage.smsTotal) : allowance(plan?.sms),
    smsRemaining: sms ? (usage.smsRemaining ?? null) : null,
  };
}

export type LookupDetails = {
  orderNumber: string | null;
  destinationVi: string | null;
  destinationEn: string | null;
};

/**
 * The order and destination shown on the lookup page (vande #037). The
 * destination is the plan's country, or its region for a multi-country plan.
 */
export async function loadLookupDetails(
  dataSource: DataSource | undefined,
  esimId: number,
): Promise<LookupDetails> {
  const empty = { orderNumber: null, destinationVi: null, destinationEn: null };
  if (!dataSource) return empty;
  const rows: Array<{
    orderNumber: string | null;
    dVi: string | null;
    dEn: string | null;
    rVi: string | null;
    rEn: string | null;
  }> = await dataSource.query(
    `SELECT o."orderNumber" AS "orderNumber",
            COALESCE(d."titleVi", d."name") AS "dVi",
            COALESCE(d."title", d."name") AS "dEn",
            COALESCE(r."titleVi", r."name") AS "rVi",
            COALESCE(r."title", r."name") AS "rEn"
     FROM "esim" e
     LEFT JOIN "order_item" oi ON oi.id = e."orderItemId"
     LEFT JOIN "order" o ON o.id = oi."orderId"
     LEFT JOIN "plan" p ON p.id = e."planId"
     LEFT JOIN "destination" d ON d.id = p."destinationId"
     LEFT JOIN "region" r ON r.id = p."regionId"
     WHERE e.id = $1`,
    [esimId],
  );
  const row = rows[0];
  if (!row) return empty;
  return {
    orderNumber: row.orderNumber ?? null,
    destinationVi: row.dVi ?? row.rVi ?? null,
    destinationEn: row.dEn ?? row.rEn ?? null,
  };
}
