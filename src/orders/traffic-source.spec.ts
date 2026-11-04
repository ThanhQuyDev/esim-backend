import { classifyTraffic, cleanTrafficSignals } from './traffic-source';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148';

/** "Nguồn truy cập" (vande-0411 #052). */
describe('traffic source', () => {
  it.each([
    [{ clickIds: ['gclid'] }, 'ads', 'Google Ads'],
    [{ clickIds: ['gbraid'] }, 'ads', 'Google Ads'],
    [{ clickIds: ['wbraid'] }, 'ads', 'Google Ads'],
    [{ clickIds: ['ttclid'] }, 'ads', 'TikTok Ads'],
    [{ clickIds: ['msclkid'] }, 'ads', 'Microsoft Ads'],
    [
      { clickIds: ['fbclid'], utmMedium: 'cpc', referrer: 'l.facebook.com' },
      'ads',
      'Facebook Ads',
    ],
    [
      { clickIds: ['fbclid'], referrer: 'l.instagram.com' },
      'social',
      'Instagram',
    ],
    [
      { clickIds: ['fbclid'], referrer: 'l.facebook.com' },
      'social',
      'Facebook',
    ],
    [{ utmSource: 'chatgpt.com' }, 'ai', 'ChatGPT'],
    [{ referrer: 'gemini.google.com' }, 'ai', 'Gemini'],
    [{ referrer: 'www.perplexity.ai' }, 'ai', 'Perplexity'],
    [{ referrer: 'copilot.microsoft.com' }, 'ai', 'Copilot'],
    [{ referrer: 'claude.ai' }, 'ai', 'Claude'],
    [{ referrer: 'www.google.com.vn' }, 'search', 'Google'],
    [{ referrer: 'coccoc.com' }, 'search', 'Cốc Cốc'],
    [
      { referrer: 'www.google.com', textFragment: true },
      'search',
      'Google (đoạn trích / AI Overview)',
    ],
    [{ referrer: 'www.youtube.com' }, 'social', 'YouTube'],
    [{ referrer: 'android-app://com.google.android.gm' }, 'referral', 'Gmail'],
    [{ referrer: 'android-app://com.zing.zalo' }, 'social', 'Zalo'],
    [
      { referrer: 'android-app://com.example.reader' },
      'referral',
      'Ứng dụng: com.example.reader',
    ],
    [{ referrer: 'blog.example.vn' }, 'referral', 'Web: blog.example.vn'],
    [{ utmSource: 'newsletter' }, 'referral', 'Email'],
    [{ utmSource: 'facebook', utmMedium: 'paid' }, 'ads', 'Facebook Ads'],
    [
      { partnerLink: true, referrer: 'www.google.com' },
      'partner',
      'Link đối tác',
    ],
    [{ secFetchSite: 'none' }, 'direct', 'Trực tiếp (tự tìm đến)'],
    [{ secFetchSite: 'cross-site' }, 'hidden', 'Từ link, không rõ nơi'],
    [{}, 'unknown', 'Không rõ'],
  ])('should read %j', (signals, group, source) => {
    expect(classifyTraffic(signals, IPHONE)).toEqual({ group, source });
  });

  it.each([
    ['Mozilla/5.0 [FBAN/FBIOS;FBAV/450.0]', 'Facebook'],
    ['Mozilla/5.0 (Linux; Android 14) [FB_IAB/FB4A;FBAV/450.0]', 'Facebook'],
    ['Mozilla/5.0 [FBAN/MessengerForiOS;FBAV/450.0]', 'Messenger'],
    ['Mozilla/5.0 Mobile Instagram 320.0', 'Instagram'],
    ['Mozilla/5.0 Mobile musical_ly_30.0', 'TikTok'],
    ['Mozilla/5.0 Mobile BytedanceWebview/d8a21c6', 'TikTok'],
    ['Mozilla/5.0 Mobile Zalo iOS', 'Zalo'],
    ['Mozilla/5.0 Mobile Line/13.0', 'LINE'],
  ])('should know the app from "%s"', (userAgent, source) => {
    expect(classifyTraffic({ secFetchSite: 'cross-site' }, userAgent)).toEqual({
      group: 'social',
      source,
    });
  });

  it('should keep no address, no click value and no personal word', () => {
    const clean = cleanTrafficSignals({
      referrer: 'https://example.vn/orders?email=a@b.vn',
      utmSource: 'a@b.vn',
      utmCampaign: 'sale-11',
      clickIds: ['gclid', 'email'],
      secFetchSite: 'anything',
    });
    expect(clean.referrer).toBeNull();
    expect(clean.utmSource).toBeNull();
    expect(clean.utmCampaign).toBe('sale-11');
    expect(clean.clickIds).toEqual(['gclid']);
    expect(clean.secFetchSite).toBeNull();
  });
});
