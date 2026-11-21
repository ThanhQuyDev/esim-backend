/**
 * What the customer's "eSIM của tôi" card may offer, decided here
 * (vande-2011 #042). The storefront used to decide it from the eSIM's supplier
 * name, which it is no longer sent.
 */

/** Suppliers whose eSIMs can be recharged (MicroEsim has no recharge API). */
const TOPUP_SUPPLIERS = new Set([
  'airalo',
  'esimaccess',
  'gadgetkorea',
  'billion',
]);

/** Order states in which the eSIM is gone for good. */
const TOPUP_BLOCKED_STATUSES = new Set([
  'refunded',
  'expired',
  'cancelled',
  'failed',
]);

export type CustomerTopupFlags = {
  /** Show the top-up button. */
  canTopUp: boolean;
  /**
   * Only the supplier's own recharge list says whether anything can be bought
   * (Billion): ask `/topup/packages` before showing a button.
   */
  topupAsksPackages: boolean;
};

export function customerTopupFlags(esim: {
  provider?: string | null;
  status?: string | null;
  plan?: { topUp?: boolean | null } | null;
}): CustomerTopupFlags {
  const supplier = String(esim.provider ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const blocked = TOPUP_BLOCKED_STATUSES.has(
    String(esim.status ?? '').toLowerCase(),
  );
  if (!TOPUP_SUPPLIERS.has(supplier) || blocked) {
    return { canTopUp: false, topupAsksPackages: false };
  }
  if (supplier === 'billion') {
    return { canTopUp: true, topupAsksPackages: true };
  }
  return { canTopUp: esim.plan?.topUp === true, topupAsksPackages: false };
}

export function withCustomerTopupFlags<T extends object>(
  esim: T,
): T & CustomerTopupFlags {
  return Object.assign(esim, customerTopupFlags(esim as never));
}
