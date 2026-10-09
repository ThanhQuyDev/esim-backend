/**
 * What each line of an order is really worth, and what the order is worth
 * after refunds (#009, test round 4).
 *
 * The hole this closes: a coupon lowered the ORDER total, but per-line refunds
 * paid back each line's LIST price — refunding every line one by one returned
 * more than the customer paid, the whole discount on top. The discount is now
 * shared out over the lines in proportion to their price, so a dear line
 * carries more of it than a cheap one:
 *
 *   line share = discount × line price ÷ sum of line prices
 *
 * rounded to the đồng, with the last line taking the rounding remainder so the
 * shares always add up to the discount exactly. For a percentage coupon that
 * is the same as "% × line price" (up to rounding) — and still right when the
 * coupon is capped.
 */

export interface PricedLine {
  id: number;
  vndPrice: number | string | null | undefined;
  vndCostPrice?: number | string | null;
  quantity?: number | null;
  status?: string | null;
}

/** Discount share per line id; shares add up to `discountVnd` exactly. */
export function allocateDiscount(
  lines: PricedLine[],
  discountVnd: number,
): Map<number, number> {
  const shares = new Map<number, number>();
  const discount = Math.max(Math.round(Number(discountVnd) || 0), 0);
  const total = lines.reduce((sum, l) => sum + (Number(l.vndPrice) || 0), 0);
  if (lines.length === 0) return shares;
  if (discount === 0 || total <= 0) {
    for (const line of lines) shares.set(Number(line.id), 0);
    return shares;
  }

  // Ordered by id so "the last line" is the same line every time.
  const ordered = [...lines].sort((a, b) => Number(a.id) - Number(b.id));
  let given = 0;
  ordered.forEach((line, index) => {
    const share =
      index === ordered.length - 1
        ? discount - given
        : Math.round((discount * (Number(line.vndPrice) || 0)) / total);
    given += share;
    shares.set(Number(line.id), share);
  });
  return shares;
}

/** The order's whole discount: coupon plus referral. */
export function orderDiscountVnd(order: {
  couponDiscountVndAmount?: number | string | null;
  referralDiscountVndAmount?: number | string | null;
}): number {
  return (
    (Number(order.couponDiscountVndAmount) || 0) +
    (Number(order.referralDiscountVndAmount) || 0)
  );
}

/** Line price after its share of the discount. */
export function netLineVnd(line: PricedLine, share: number): number {
  return Math.max((Number(line.vndPrice) || 0) - share, 0);
}

/** One eSIM of a line, after the discount: the net line over its quantity. */
export function netUnitVnd(line: PricedLine, share: number): number {
  const quantity = Math.max(Number(line.quantity ?? 1), 1);
  return Math.round(netLineVnd(line, share) / quantity);
}

/**
 * Cost of what has been refunded: refunded lines whole, plus single refunded
 * eSIMs of lines still live, each at the line's unit cost.
 */
export function refundedCostVnd(
  lines: PricedLine[],
  esims: Array<{ orderItemId?: number | null; status?: string | null }>,
): number {
  let cost = 0;
  for (const line of lines) {
    const lineCost = Number(line.vndCostPrice) || 0;
    if (line.status === 'refunded') {
      cost += lineCost;
      continue;
    }
    const refundedEsims = esims.filter(
      (e) =>
        Number(e.orderItemId) === Number(line.id) && e.status === 'refunded',
    ).length;
    if (refundedEsims > 0) {
      const quantity = Math.max(Number(line.quantity ?? 1), 1);
      cost += Math.round((lineCost / quantity) * refundedEsims);
    }
  }
  return cost;
}
