/**
 * SECURITY 12/11/2026 — supplier webhooks carry no signature we can check
 * (Gadget Korea sends none; Billion and MicroEsim define none; the Airalo /
 * EsimAccess secrets are unset), and they looked the eSIM up by the ICCID in
 * the payload across every order. Anyone could post a customer's ICCID with
 * their own order's id and the eSIM — QR code included — moved to their
 * account, or post a fake QR code onto the customer's eSIM.
 *
 * A webhook may only touch an eSIM that already belongs to one of the order
 * items it was matched to (a supplier's retry of the same delivery), or an
 * unowned row of the same supplier that no order holds yet. Anything else is
 * someone else's eSIM and is left alone.
 */
export function webhookMayUpdateEsim(
  existing: {
    orderItemId?: number | null;
    userId?: number | null;
    provider?: string | null;
  },
  matchedOrderItemIds: number[],
  provider: string,
): boolean {
  if (existing.orderItemId != null) {
    return matchedOrderItemIds
      .map(Number)
      .includes(Number(existing.orderItemId));
  }
  return existing.provider === provider && existing.userId == null;
}
