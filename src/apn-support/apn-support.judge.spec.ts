import { ApnSupportService } from './apn-support.service';
import type { ApnCapabilities } from './apn-support.types';

/**
 * Judging one plan from its APN (#065, feeding #067).
 *
 * Two suppliers answer this question in two different ways: esimaccess says it in
 * the package name ("nonhkip") and gives no APN at all, everyone else gives an APN
 * that has to be looked up. What the tests pin is the direction of every unknown:
 * a plan is advertised as working with TikTok only when the table says so.
 */
describe('ApnSupportService.judgePlan', () => {
  const service = new ApnSupportService({
    findAll: jest.fn(),
    findAllWithPagination: jest.fn(),
    findByApn: jest.fn(),
    replaceAll: jest.fn(),
    count: jest.fn(),
  } as never);

  const caps = (
    tiktok: [boolean, boolean],
    chatGpt: [boolean, boolean],
  ): ApnCapabilities => ({
    tiktok: { ios: tiktok[0], android: tiktok[1] },
    chatGpt: { ios: chatGpt[0], android: chatGpt[1] },
    gemini: { ios: true, android: true },
    claude: { ios: false, android: false },
  });

  const table = new Map<string, ApnCapabilities>([
    // The worked example from the real sheet: iPhone yes, Android no.
    ['cmhk', caps([true, false], [true, true])],
    ['local-vn', caps([true, true], [true, true])],
    ['3gnet', caps([false, false], [true, true])],
    // ChatGPT on one device only is not something the page can promise either.
    ['half-gpt', caps([true, true], [true, false])],
  ]);

  it('should read the per-platform answer straight off the table', () => {
    expect(service.judgePlan({ apn: 'cmhk' }, table)).toEqual({
      tiktokIos: true,
      tiktokAndroid: false,
      tiktokAllDevices: false,
      chatGpt: true,
      known: true,
    });
  });

  it('should only claim "every device" when both platforms work', () => {
    expect(service.judgePlan({ apn: 'local-vn' }, table).tiktokAllDevices).toBe(
      true,
    );
    expect(service.judgePlan({ apn: 'cmhk' }, table).tiktokAllDevices).toBe(
      false,
    );
  });

  it('should not claim ChatGPT when it only works on one device', () => {
    // Same reason as TikTok: the storefront does not know the visitor's device.
    expect(service.judgePlan({ apn: 'half-gpt' }, table).chatGpt).toBe(false);
  });

  it('should allow ChatGPT without TikTok', () => {
    // The common China case, and the reason #068 needs two separate statements.
    expect(service.judgePlan({ apn: '3gnet' }, table)).toMatchObject({
      tiktokAllDevices: false,
      chatGpt: true,
      known: true,
    });
  });

  it('should treat an APN the table has never heard of as a no', () => {
    // "We do not know" must not read as "it works".
    expect(service.judgePlan({ apn: 'unknown-apn' }, table)).toEqual({
      tiktokIos: false,
      tiktokAndroid: false,
      tiktokAllDevices: false,
      chatGpt: false,
      known: false,
    });
  });

  it('should treat a plan with no APN as a no', () => {
    // Every supplier but esimaccess gives one; a missing APN is missing data.
    expect(service.judgePlan({ apn: null }, table).chatGpt).toBe(false);
    expect(service.judgePlan({ apn: '   ' }, table).chatGpt).toBe(false);
    expect(service.judgePlan({}, table).chatGpt).toBe(false);
  });

  it('should match the APN whatever case the supplier sent', () => {
    expect(service.judgePlan({ apn: ' CMHK ' }, table).tiktokIos).toBe(true);
  });

  it('should take esimaccess at its word via the nonhkip flag', () => {
    // esimaccess states this in the package name and sends no APN (#041), so the
    // flag is the only evidence there is — and it is evidence of a local exit IP,
    // which is the whole point.
    expect(service.judgePlan({ apn: null, isNonHkIp: true }, table)).toEqual({
      tiktokIos: true,
      tiktokAndroid: true,
      tiktokAllDevices: true,
      chatGpt: true,
      known: true,
    });
  });

  it('should let the nonhkip flag win over an APN that says no', () => {
    // A nonhkip package exits locally regardless of the APN recorded against it.
    expect(
      service.judgePlan({ apn: '3gnet', isNonHkIp: true }, table)
        .tiktokAllDevices,
    ).toBe(true);
  });

  it('should say no to everything when no sheet has been uploaded', () => {
    // The table starts empty, and that must not advertise anything.
    const empty = new Map<string, ApnCapabilities>();

    expect(service.judgePlan({ apn: 'cmhk' }, empty)).toEqual({
      tiktokIos: false,
      tiktokAndroid: false,
      tiktokAllDevices: false,
      chatGpt: false,
      known: false,
    });
  });
});
