/**
 * The buyer's device, read from the browser's user-agent when the order is
 * placed (doitac-1410 #082, #083): desktop / mobile / tablet, and which
 * browser on which system — "Chrome 141 · Windows". Good enough for the CMS;
 * not a fingerprint.
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface DeviceInfo {
  type: DeviceType | null;
  browser: string | null;
  os: string | null;
}

export function deviceType(ua: string | null | undefined): DeviceType | null {
  const s = ua ?? '';
  if (!s.trim()) return null;
  // iPad on iPadOS 13+ reports itself as a Mac; the site sends no hint, so
  // "Macintosh" + touch cannot be told apart here and stays desktop.
  if (/iPad|Tablet|PlayBook|Silk|Kindle|SM-T\d|Nexus (7|9|10)/i.test(s)) {
    return 'tablet';
  }
  // Android phones say "Mobile"; an Android without it is a tablet.
  if (/Android/i.test(s) && !/Mobile/i.test(s)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini|IEMobile/i.test(s)) {
    return 'mobile';
  }
  return 'desktop';
}

/** Browser and version, in the order that matters: Edge and Opera say Chrome too. */
function browserOf(s: string): string | null {
  const rules: Array<[RegExp, string]> = [
    [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
    [/(?:OPR|Opera)\/(\d+)/, 'Opera'],
    [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
    [/CocCoc\/(\d+)|coc_coc_browser\/(\d+)/i, 'Cốc Cốc'],
    [/Zalo(?:Theme)?\/?(\d+)?/i, 'Zalo'],
    [/FBAN|FBAV\/(\d+)/, 'Facebook'],
    [/Instagram (\d+)/, 'Instagram'],
    [/Firefox\/(\d+)|FxiOS\/(\d+)/, 'Firefox'],
    [/CriOS\/(\d+)/, 'Chrome'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)[\d.]* .*Safari/, 'Safari'],
  ];
  for (const [re, name] of rules) {
    const m = re.exec(s);
    if (m) {
      const version = m.slice(1).find(Boolean);
      return version ? `${name} ${version}` : name;
    }
  }
  return null;
}

function osOf(s: string): string | null {
  if (/iPhone|iPad|iPod/.test(s)) {
    const v = /OS (\d+)[_\d]* like Mac/.exec(s)?.[1];
    return v ? `iOS ${v}` : 'iOS';
  }
  const android = /Android (\d+)/.exec(s);
  if (android) return `Android ${android[1]}`;
  if (/Android/.test(s)) return 'Android';
  if (/Windows/.test(s)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(s)) return 'macOS';
  if (/CrOS/.test(s)) return 'ChromeOS';
  if (/Linux/.test(s)) return 'Linux';
  return null;
}

export function deviceInfo(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? '';
  return { type: deviceType(s), browser: browserOf(s), os: osOf(s) };
}

/** Stored as typed, cut to the column's size. */
export function storedUserAgent(ua: string | null | undefined): string | null {
  const s = (ua ?? '').trim();
  return s ? s.slice(0, 500) : null;
}
