import { isPlanRefundable, ruleRefundable } from './plan-refund-policy';

/** Refund support per plan (doitac-1410 #080). */
describe('plan refund policy', () => {
  it('should refuse eSIM nội địa and Viettel', () => {
    expect(
      ruleRefundable({
        provider: 'itel',
        isDomesticEsim: true,
        isLocalInventory: true,
      }),
    ).toBe(false);
    expect(
      ruleRefundable({ provider: 'viettel', isLocalInventory: true }),
    ).toBe(false);
  });

  it('should refuse MicroEsim plans named Local, not the others', () => {
    expect(
      ruleRefundable({ provider: 'microesim', name: 'Japan Local 5GB 7 days' }),
    ).toBe(false);
    expect(
      ruleRefundable({ provider: 'microesim', name: 'Japan 5GB 7 days' }),
    ).toBe(true);
    // "Locale" / "Localised" is not "Local".
    expect(
      ruleRefundable({ provider: 'microesim', name: 'Localised Asia 3GB' }),
    ).toBe(true);
  });

  it("should refuse Billion's partner carriers, keep Billion Connect's own", () => {
    for (const operatorName of [
      'T-Mobile',
      'CMLink',
      'SK Telecom',
      'SKT',
      'KDDI',
      'Unitel',
    ]) {
      expect(
        ruleRefundable({ provider: 'billion', operatorName, name: 'X' }),
      ).toBe(false);
    }
    expect(
      ruleRefundable({
        provider: 'billion',
        operatorName: 'SoftBank',
        name: 'Japan-3GB',
      }),
    ).toBe(true);
    expect(
      ruleRefundable({
        provider: 'billion',
        operatorName: null,
        name: 'Japan-KDDI-3GB',
      }),
    ).toBe(false);
  });

  it('should refund every other supplier', () => {
    for (const provider of ['airalo', 'esimaccess', 'gadgetkorea']) {
      expect(ruleRefundable({ provider, name: 'Korea Local 3GB' })).toBe(true);
    }
  });

  it("should let the admin's setting win over the rule", () => {
    expect(
      isPlanRefundable({
        provider: 'viettel',
        isLocalInventory: true,
        refundableOverride: true,
      }),
    ).toBe(true);
    expect(
      isPlanRefundable({ provider: 'airalo', refundableOverride: false }),
    ).toBe(false);
    expect(
      isPlanRefundable({ provider: 'airalo', refundableOverride: null }),
    ).toBe(true);
    expect(isPlanRefundable(null)).toBe(true);
  });
});
