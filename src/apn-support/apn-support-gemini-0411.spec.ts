import { ApnSupportService } from './apn-support.service';

/** vande-0411 #041 — ctm-mobile runs TikTok and Gemini, and read a bare "Chỉ". */
describe('APN verdict beyond ChatGPT (vande-0411 #041)', () => {
  const both = (value: boolean) => ({ ios: value, android: value });
  const table = new Map([
    [
      'ctm-mobile',
      {
        tiktok: both(true),
        chatGpt: both(false),
        gemini: both(true),
        claude: both(false),
      },
    ],
  ]);
  const service = Object.create(
    ApnSupportService.prototype,
  ) as ApnSupportService;

  it('should say which AI apps an APN runs', () => {
    expect(service.judgePlan({ apn: 'ctm-mobile' }, table as never)).toEqual({
      tiktokIos: true,
      tiktokAndroid: true,
      tiktokAllDevices: true,
      chatGpt: false,
      gemini: true,
      claude: false,
      known: true,
    });
  });
});
