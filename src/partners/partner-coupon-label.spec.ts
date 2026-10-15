import { couponDiscountLabel, couponSourceLabel } from './partner-coupon-label';

/**
 * The "Nguồn ghi nhận" of an order bought on a code names what the code gave
 * the customer (doitac-1410 #021).
 */
describe('couponSourceLabel', () => {
  it('should show a percent code with what it took off the order', () => {
    expect(
      couponSourceLabel('NAM2026', {
        couponDiscountType: 'percent',
        couponDiscountValue: 7,
        couponDiscountVnd: 10000,
      }),
    ).toBe('Mã: NAM2026 (giảm 7% · -10.000đ)');
  });

  it('should show a fixed code as money', () => {
    expect(
      couponDiscountLabel({
        couponDiscountType: 'fixed',
        couponDiscountValue: 20000,
        couponDiscountVnd: 20000,
      }),
    ).toBe('giảm 20.000đ · -20.000đ');
  });

  it('should fall back to the bare code when nothing is known', () => {
    expect(couponSourceLabel('VANA10', {})).toBe('Mã: VANA10');
  });
});
