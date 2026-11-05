import { ruleRefundable, type RefundPolicyPlan } from './plan-refund-policy';

/**
 * "Thời điểm bắt đầu tính gói" (vande-0411 #025): when a plan's days start
 * counting, on each supplier's own terms.
 *
 * - Airalo: `operator.activation_policy` from `GET /v2/packages`.
 * - eSIM Access: `activeType` from `package/list`, known before buying; the
 *   price file's "Billing starts" only until a sync brings it (#027).
 * - Gadget Korea: "PreInstallation" in the import file; Turkey, and any region
 *   with Turkey in it, must be installed before arriving.
 * - Billion, MicroEsim: as the refund rule, a refundable plan counts from the
 *   first connection and a local one from the install.
 * - Viettel and domestic eSIMs: from the install.
 *
 * Null when the supplier has not said yet: the next catalogue sync fills it,
 * and a screen shows nothing rather than a guess.
 */
export type PlanValidityStart =
  | 'first_connection'
  | 'installation'
  | 'purchase'
  | 'pre_arrival';

export interface ValidityStartPlan extends RefundPolicyPlan {
  supplierActivationPolicy?: string | null;
}

const TURKEY = /\b(turkey|t[uü]rkiye)\b/i;
const PRE_ARRIVAL = /pre[\s-]?arrival/i;

export function planValidityStart(
  plan: ValidityStartPlan | null | undefined,
): PlanValidityStart | null {
  if (!plan) return null;
  if (plan.isDomesticEsim || plan.isLocalInventory) return 'installation';
  const provider = (plan.provider ?? '').toLowerCase();
  if (provider === 'viettel' || provider.endsWith('-noidia')) {
    return 'installation';
  }
  const raw = (plan.supplierActivationPolicy ?? '').trim();
  if (provider === 'airalo') {
    if (raw === 'first-usage') return 'first_connection';
    return raw === 'installation' ? 'installation' : null;
  }
  if (provider === 'esimaccess') {
    const type = Number(plan.supplierActiveType);
    if (type === 1) return 'installation';
    if (type === 2) return 'first_connection';
    if (type === 3) return 'purchase';
    if (/first\s*installation/i.test(raw)) return 'installation';
    if (/network/i.test(raw)) return 'first_connection';
    return /purchase/i.test(raw) ? 'purchase' : null;
  }
  if (provider === 'gadgetkorea') {
    return PRE_ARRIVAL.test(raw) || TURKEY.test(plan.name ?? '')
      ? 'pre_arrival'
      : 'first_connection';
  }
  if (provider === 'billion' || provider === 'microesim') {
    return ruleRefundable(plan) ? 'first_connection' : 'installation';
  }
  return null;
}
