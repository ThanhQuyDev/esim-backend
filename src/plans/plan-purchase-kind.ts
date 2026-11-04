import {
  BILLION_VAS_APNS,
  billionApnTakesVas,
} from '../esim-providers/billion/billion-catalogue';

/**
 * What can be bought on top of a plan (vande-0411 #015). A top-up extends its
 * validity; an add-on adds data and leaves the validity alone. They are not the
 * same thing, so "Có / Không" stopped being enough once Billion came along.
 *
 * `isAddOn` is the admin's hand-set flag. Without it, a Billion plan that takes
 * add-ons is read from what Billion says: `accelerationSupport` and its APN.
 */
export type PlanPurchaseKind = 'topup' | 'addon' | 'none';

export function planPurchaseKind(plan: {
  provider?: string | null;
  topUp?: boolean | null;
  isAddOn?: boolean | null;
  accelerationSupport?: number | null;
  apn?: string | null;
}): PlanPurchaseKind {
  if (plan.isAddOn) return 'addon';
  if (plan.topUp) return 'topup';
  const support = plan.accelerationSupport;
  return (plan.provider ?? '').toLowerCase() === 'billion' &&
    (support == null || Number(support) === 2 || Number(support) === 3) &&
    billionApnTakesVas(plan.apn)
    ? 'addon'
    : 'none';
}

export const PLAN_PURCHASE_KIND_LABEL: Record<PlanPurchaseKind, string> = {
  topup: 'Topup',
  addon: 'Addon',
  none: 'Không',
};

const VAS_LIST = [...BILLION_VAS_APNS].map((apn) => `'${apn}'`).join(', ');

/** The same reading in SQL, for the plan list's filter. `t` is the plan alias. */
export function planIsBillionAddonSql(t: string): string {
  return `(COALESCE(${t}."topUp", false) = false
    AND lower(${t}."provider") = 'billion'
    AND (${t}."accelerationSupport" IS NULL OR ${t}."accelerationSupport" IN (2, 3))
    AND EXISTS (SELECT 1 FROM unnest(string_to_array(lower(COALESCE(${t}."apn", '')), '/')) AS a(name)
                 WHERE trim(a.name) IN (${VAS_LIST})))`;
}
