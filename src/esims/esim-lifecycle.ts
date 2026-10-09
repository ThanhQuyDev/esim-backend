/**
 * The status an eSIM is shown and filtered by (#024, test round 4), worked out
 * from what is stored rather than stored itself: the stored status only knows
 * available / sold / refunded, while "in use" and "expired" follow from the
 * activation and expiry dates, which the usage refresh keeps current.
 *
 * The customer's rules:
 * - Chưa bán (available): local stock uploaded and waiting to be sold.
 * - Đã bán (sold): bought and delivered, not activated yet.
 * - Đang dùng (active): connected and counting down — and a local eSIM
 *   (Viettel travel, domestic) as soon as it is sold, since no Vietnamese
 *   carrier reports activation: buying it is starting it.
 * - Hết hạn (expired): past its expiry date. A domestic eSIM never expires.
 * - Đã huỷ kích hoạt (deactivated): cancelled at the supplier (esimaccess).
 * - Hoàn tiền (refunded): refunded from the order page.
 */
export type EsimLifecycleStatus =
  | 'available'
  | 'sold'
  | 'active'
  | 'expired'
  | 'deactivated'
  | 'refunded';

export const ESIM_LIFECYCLE_STATUSES: EsimLifecycleStatus[] = [
  'available',
  'sold',
  'active',
  'expired',
  'deactivated',
  'refunded',
];

const DEACTIVATED = ['deactivated', 'cancelled', 'canceled', 'revoked'];

export function esimLifecycleStatus(
  esim: {
    status?: string | null;
    activatedAt?: Date | string | null;
    expiresAt?: Date | string | null;
  },
  plan?: {
    isLocalInventory?: boolean | null;
    isDomesticEsim?: boolean | null;
  } | null,
  now: Date = new Date(),
): EsimLifecycleStatus {
  const status = (esim.status ?? '').toLowerCase();
  if (status === 'refunded') return 'refunded';
  if (DEACTIVATED.includes(status)) return 'deactivated';
  if (status === 'available') return 'available';
  if (status === 'expired') return 'expired';

  const expires = esim.expiresAt ? new Date(esim.expiresAt) : null;
  if (
    !plan?.isDomesticEsim &&
    expires &&
    !Number.isNaN(expires.getTime()) &&
    expires.getTime() < now.getTime()
  ) {
    return 'expired';
  }
  if (plan?.isLocalInventory) return 'active';
  if (esim.activatedAt || status === 'active') return 'active';
  return 'sold';
}

/**
 * The same rules in SQL, over an `esim` alias, for filtering — reading the
 * plan by subquery so it works whatever the surrounding query joined.
 */
export const ESIM_LIFECYCLE_SQL = `(CASE
  WHEN lower(esim.status) = 'refunded' THEN 'refunded'
  WHEN lower(esim.status) IN ('deactivated','cancelled','canceled','revoked') THEN 'deactivated'
  WHEN lower(esim.status) = 'available' THEN 'available'
  WHEN lower(esim.status) = 'expired' THEN 'expired'
  WHEN esim."expiresAt" IS NOT NULL AND esim."expiresAt" < now()
       AND NOT COALESCE((SELECT lp."isDomesticEsim" FROM "plan" lp WHERE lp.id = esim."planId"), false)
    THEN 'expired'
  WHEN COALESCE((SELECT lp."isLocalInventory" FROM "plan" lp WHERE lp.id = esim."planId"), false) THEN 'active'
  WHEN esim."activatedAt" IS NOT NULL OR lower(esim.status) = 'active' THEN 'active'
  ELSE 'sold'
END)`;
