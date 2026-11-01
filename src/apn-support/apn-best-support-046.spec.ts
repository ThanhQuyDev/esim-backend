import { ApnSupportService } from './apn-support.service';

/**
 * doitac-3010 #046 — the "TikTok & AI" filter reads an APN value listing
 * several APNs by its best one, like the product page does.
 */
describe('TikTok & AI filter with several APNs (doitac-3010 #046)', () => {
  const row = (apn: string, full: boolean) => ({
    apn,
    needsReview: false,
    tiktokIos: true,
    tiktokAndroid: full,
    chatGptIos: true,
    chatGptAndroid: true,
    geminiIos: true,
    geminiAndroid: true,
    claudeIos: full,
    claudeAndroid: full,
  });

  it('should count a plan APN through its full-support APN', async () => {
    const service = new ApnSupportService({
      findAll: jest
        .fn()
        .mockResolvedValue([
          row('cmlink', false),
          row('internet.proximus.be', true),
          row('cmhk', false),
        ]),
      distinctPlanApns: jest
        .fn()
        .mockResolvedValue([
          'cmlink / internet.proximus.be / cmhk',
          'cmlink / cmhk',
        ]),
    } as never);
    const apns = await service.tiktokCapablePlanApns();
    expect(apns).toContain('cmlink / internet.proximus.be / cmhk');
    expect(apns).toContain('internet.proximus.be');
    expect(apns).not.toContain('cmlink / cmhk');
  });
});
