/**
 * Whether a plan's eSIMs can be refunded (doitac-1410 #080), and with it
 * whether they roam: an eSIM the supplier takes back is a roaming one; the
 * ones that are not taken back are local SIMs, which do not roam.
 *
 * Not refundable:
 * - eSIM nội địa and Viettel (our own stock, `isLocalInventory`);
 * - MicroEsim plans with "Local" in the name;
 * - Billion plans of T-Mobile, CMLink, SK Telecom, KDDI and Unitel — Billion
 *   only takes back its own (Billion Connect) eSIMs. Billion's catalogue does
 *   not say who issues a plan, so this goes by the plan's operators.
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

/** Billion's partner carriers whose eSIMs Billion does not take back. */
export const BILLION_NON_REFUNDABLE_CARRIERS =
  /t-?mobile|cm\s?link|sk\s?telecom|\bskt\b|kddi|unitel/i;

/** The rule alone, without the admin's override. */
export function ruleRefundable(plan: RefundPolicyPlan): boolean {
  if (plan.isDomesticEsim || plan.isLocalInventory) return false;
  const provider = (plan.provider ?? '').toLowerCase();
  if (provider === 'viettel') return false;
  if (provider === 'microesim' && /\blocal\b/i.test(plan.name ?? '')) {
    return false;
  }
  if (
    provider === 'billion' &&
    BILLION_NON_REFUNDABLE_CARRIERS.test(
      `${plan.operatorName ?? ''} ${plan.name ?? ''}`,
    )
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
