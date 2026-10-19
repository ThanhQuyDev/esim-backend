import { deviceInfo, deviceType, storedUserAgent } from './device-info';

/** The buyer's device on an order (doitac-1410 #082). */
const UA = {
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  zalo: 'Mozilla/5.0 (Linux; Android 13; RMX3630) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Zalo android/12100651 ZaloTheme/light',
  coccoc:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/134.0.0 Chrome/128.0.0.0 Safari/537.36',
};

describe('deviceInfo', () => {
  it('should tell desktop, mobile and tablet apart', () => {
    expect(deviceType(UA.winChrome)).toBe('desktop');
    expect(deviceType(UA.macSafari)).toBe('desktop');
    expect(deviceType(UA.iphoneSafari)).toBe('mobile');
    expect(deviceType(UA.androidPhone)).toBe('mobile');
    expect(deviceType(UA.androidTablet)).toBe('tablet');
    expect(deviceType(UA.ipad)).toBe('tablet');
    expect(deviceType('')).toBeNull();
    expect(deviceType(null)).toBeNull();
  });

  it('should name the browser and system', () => {
    expect(deviceInfo(UA.winChrome)).toEqual({
      type: 'desktop',
      browser: 'Chrome 141',
      os: 'Windows',
    });
    expect(deviceInfo(UA.winEdge).browser).toBe('Edge 141');
    expect(deviceInfo(UA.macSafari)).toEqual({
      type: 'desktop',
      browser: 'Safari 18',
      os: 'macOS',
    });
    expect(deviceInfo(UA.iphoneSafari)).toEqual({
      type: 'mobile',
      browser: 'Safari 18',
      os: 'iOS 18',
    });
    expect(deviceInfo(UA.iphoneChrome).browser).toBe('Chrome 141');
    expect(deviceInfo(UA.androidPhone).os).toBe('Android 14');
    expect(deviceInfo(UA.zalo).browser).toMatch(/^Zalo/);
    expect(deviceInfo(UA.coccoc).browser).toBe('Cốc Cốc 134');
  });

  it('should store the user-agent cut to 500 characters', () => {
    expect(storedUserAgent('x'.repeat(600))).toHaveLength(500);
    expect(storedUserAgent('   ')).toBeNull();
  });
});
