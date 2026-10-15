/**
 * What a discount code gave the customer, as the partner reads it beside the
 * code (doitac-1410 #021): the code's rule ("giảm 7%" / "giảm 20.000đ") and
 * the money it actually took off this order.
 */
export type CouponDiscountInfo = {
  couponDiscountType?: string | null;
  couponDiscountValue?: number | null;
  couponDiscountVnd?: number | null;
};

const vnd = (value: number) => `${Math.round(value).toLocaleString('vi-VN')}đ`;

export function couponDiscountLabel(info: CouponDiscountInfo): string {
  const parts: string[] = [];
  const value = Number(info.couponDiscountValue ?? 0);
  if (value > 0) {
    parts.push(
      info.couponDiscountType === 'fixed'
        ? `giảm ${vnd(value)}`
        : `giảm ${Number(value.toFixed(2))}%`,
    );
  }
  const taken = Number(info.couponDiscountVnd ?? 0);
  if (taken > 0) parts.push(`-${vnd(taken)}`);
  return parts.join(' · ');
}

/** "Mã: VANA10 (giảm 7% · -10.000đ)" — or just the code when nothing is known. */
export function couponSourceLabel(
  code: string,
  info: CouponDiscountInfo,
  prefix = 'Mã: ',
): string {
  const label = couponDiscountLabel(info);
  return `${prefix}${code}${label ? ` (${label})` : ''}`;
}
