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
    // Real Billion names (vande #010). Read from the NAME: `operatorName` is
    // the list of networks a plan roams on, not who issues it.
    for (const name of [
      'USA(T-Mobile)-8days-Unlimited-T-Mobile - 8 days',
      'CO Russia-30GB,128kbps-CO-OTA - 30 days',
      'CO Singapore Malaysia Thailand-1GB/Natural day+CO-OTA - 2 days',
      'CO Global 38-3GB/Natural Day-CO-OTA - 7 days',
      'Orange World Global-50GB,128kbps-Orange - 30 days',
      'Orange Holiday Europe-7Days-1GB-Orange',
      'Orange Holiday Europe-20GB,0kbps',
      'Canada-Telus Local-30days-50GB-Telus',
      'Canada-Telus Local-30days-75GB-Telus',
      'Japan-SoftBank Local-5G-30GB-Softbank',
      'Japan-SoftBank Local-5G-50GB-Softbank',
      '[5G] Japan-KDDI Local-Unlimited-4 days- KDDI',
      'South Korea(SKT)-5days-Unlimited Data-eSIM-SKT',
      'Laos-Unitel Local-30days-30GB-Unitel',
    ]) {
      expect(ruleRefundable({ provider: 'billion', name })).toBe(false);
    }
    for (const [name, operatorName] of [
      ['[5G]Japan(SoftBank)-5GB/Natural day - 7 days', 'SoftBank'],
      ['Japan(KDDI)-10days-unlimited/Natural Day', 'KDDI'],
      ['Vietnam-1GB/Natural day - 8 days', 'Vinaphone'],
      ['Korea-3GB/Natural day', 'SK Telecom, KT'],
      ['China Hong Kong Macao-TikTok-1GB,384kbps - 3 days', 'CMHK'],
    ]) {
      expect(ruleRefundable({ provider: 'billion', name, operatorName })).toBe(
        true,
      );
    }
  });

  it('should refuse MicroEsim "Local" glued to the carrier (vande #010)', () => {
    for (const name of [
      'Japan-LocalIIJ-Total50GB-30-D0',
      'Japan-LocalIIJ-Total50GB-5-D0',
      'Laos-Local-Total30GB-15-B0',
    ]) {
      expect(ruleRefundable({ provider: 'microesim', name })).toBe(false);
    }
    expect(
      ruleRefundable({ provider: 'microesim', name: 'Global 108 Regions-5GB' }),
    ).toBe(true);
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
