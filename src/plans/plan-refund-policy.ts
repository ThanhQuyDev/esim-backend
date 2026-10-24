/**
 * Whether a plan's eSIMs can be refunded (doitac-1410 #080), and with it
 * whether they roam: an eSIM the supplier takes back is a roaming one; the
 * ones that are not taken back are local SIMs, which do not roam.
 *
 * Not refundable:
 * - eSIM nội địa and Viettel (our own stock, `isLocalInventory`);
 * - MicroEsim plans with "Local" in the name — also glued to the carrier,
 *   as in "Japan-LocalIIJ-Total50GB" (vande #010);
 * - Billion plans issued by T-Mobile, CMLink ("CO …-CO-OTA"), Orange, Telus,
 *   SK Telecom, Unitel, and any "Local" SIM (KDDI / SoftBank / TrueMove H
 *   Local…) — Billion only takes back its own (Billion Connect) eSIMs.
 *
 * Billion is read from the plan NAME only, never from `operatorName`: that is
 * the list of networks the plan roams on, so a Billion Connect plan reaching
 * Japan on KDDI was wrongly refused a refund, while CMLink's "CO Russia" (on
 * MTS) and every Orange, Telus and SoftBank Local plan were let through. The
 * catalogue's own `provider` field is blank on 130 plans, the name never is.
 * Checked against Billion's full eSIM catalogue on 25/10/2026: no Billion
 * Connect plan matches except its "Local" SIMs, and no other issuer's plan is
 * missed.
 * Everything else is refundable. An admin can set it by hand per plan
 * (`refundableOverride`), which wins over the rule.
 */
export interface RefundPolicyPlan {
  provider?: string | null;
  name?: string | null;
  operatorName?: string | null;
  isLocalInventory?: boolean | null;
  isDomesticEsim?: boolean | null;
  refundableOverride?: boolean | null;
}

/** Billion plans, by name, that Billion does not take back (vande #010). */
export const BILLION_NON_REFUNDABLE_CARRIERS =
  /t-?mobile|cm\s?link|(^|[\s-])co(-ota|\s)|\borange\b|telus|sk\s?telecom|\bskt\b|unitel|\blocal\b/i;

/** "Local" in a MicroEsim name, on its own or glued on ("-LocalIIJ"). */
const MICROESIM_LOCAL = /(^|[^a-z])local(?!i[sz]|e\b)/i;

/** The rule alone, without the admin's override. */
export function ruleRefundable(plan: RefundPolicyPlan): boolean {
  if (plan.isDomesticEsim || plan.isLocalInventory) return false;
  const provider = (plan.provider ?? '').toLowerCase();
  if (provider === 'viettel' || provider.endsWith('-noidia')) return false;
  if (provider === 'microesim' && MICROESIM_LOCAL.test(plan.name ?? '')) {
    return false;
  }
  if (
    provider === 'billion' &&
    BILLION_NON_REFUNDABLE_CARRIERS.test((plan.name ?? '').trim())
  ) {
    return false;
  }
  return true;
}

export function isPlanRefundable(plan: RefundPolicyPlan | null | undefined) {
  if (!plan) return true;
  if (plan.refundableOverride === true || plan.refundableOverride === false) {
    return plan.refundableOverride;
  }
  return ruleRefundable(plan);
}
