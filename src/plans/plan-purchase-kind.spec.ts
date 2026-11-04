import { planPurchaseKind } from './plan-purchase-kind';

/** vande-0411 #015 — Topup / Addon / Không. */
describe('Loại mua thêm của gói (vande-0411 #015)', () => {
  it('should read a plan that takes top-ups as Topup', () => {
    expect(planPurchaseKind({ provider: 'airalo', topUp: true })).toBe('topup');
  });

  it('should read a Billion plan that takes add-ons as Addon', () => {
    const plan = { provider: 'billion', topUp: false, apn: 'cmhk' };
    expect(planPurchaseKind({ ...plan, accelerationSupport: 2 })).toBe('addon');
    expect(planPurchaseKind({ ...plan, accelerationSupport: 3 })).toBe('addon');
    expect(planPurchaseKind({ ...plan, apn: 'CMHK/cmlink' })).toBe('addon');
  });

  it('should not call a Billion plan an add-on without both signs', () => {
    const plan = { provider: 'billion', topUp: false };
    expect(
      planPurchaseKind({ ...plan, apn: 'cmhk', accelerationSupport: 0 }),
    ).toBe('none');
    expect(
      planPurchaseKind({
        ...plan,
        apn: 'internet.proximus.be',
        accelerationSupport: 3,
      }),
    ).toBe('none');
  });

  it('should keep the top-up when a Billion plan has both', () => {
    expect(
      planPurchaseKind({
        provider: 'billion',
        topUp: true,
        apn: 'cmhk',
        accelerationSupport: 3,
      }),
    ).toBe('topup');
  });

  it("should obey the admin's flag", () => {
    expect(planPurchaseKind({ isAddOn: true, topUp: true })).toBe('addon');
  });

  it('should leave other suppliers at Không', () => {
    expect(
      planPurchaseKind({ provider: 'airalo', apn: 'cmhk', topUp: false }),
    ).toBe('none');
  });
});
