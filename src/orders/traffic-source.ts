/**
 * "Nguồn truy cập": where the buyer came from (vande-0411 #052).
 *
 * The storefront notes the signals of the first page of a browsing session and
 * sends them with the order. Only short facts are kept, never a whole address,
 * which can carry a person's details: the referring site's name, the UTM words,
 * which click ids were present (not their values), and whether Google quoted a
 * passage (not the passage).
 */

export const TRAFFIC_GROUPS = [
  'ads',
  'social',
  'search',
  'ai',
  'partner',
  'referral',
  'direct',
  'hidden',
  'unknown',
] as const;
export type TrafficGroup = (typeof TRAFFIC_GROUPS)[number];

export const CLICK_IDS = [
  'gclid',
  'gbraid',
  'wbraid',
  'dclid',
  'srsltid',
  'fbclid',
  'igshid',
  'ttclid',
  'msclkid',
  'twclid',
  'li_fat_id',
] as const;

export type TrafficSignals = {
  /** A site's name, or `android-app://<package>`. */
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  clickIds?: string[] | null;
  /** The Sec-Fetch-Site header of the page the session opened on. */
  secFetchSite?: string | null;
  /** The link carried `#:~:text=`: a Google passage or AI Overview. */
  textFragment?: boolean | null;
  /** Arrived through a partner's marketing link. */
  partnerLink?: boolean | null;
};

export type TrafficSource = { group: TrafficGroup; source: string };

type Known = { source: string; group: TrafficGroup; pattern: RegExp };

const AI: Known[] = [
  ['ChatGPT', /chatgpt|openai/],
  ['Gemini', /gemini|bard\.google/],
  ['Perplexity', /perplexity/],
  ['Copilot', /copilot/],
  ['Claude', /claude|anthropic/],
  ['DeepSeek', /deepseek/],
  ['Grok', /(^|\.)grok(\.|$)/],
  ['Meta AI', /(^|\.)meta\.ai$/],
].map(([source, pattern]) => ({
  source: source as string,
  pattern: pattern as RegExp,
  group: 'ai' as const,
}));

const PLACES: Known[] = [
  ['Messenger', /messenger|(^|\.)m\.me$/, 'social'],
  ['Instagram', /instagram/, 'social'],
  ['Facebook', /facebook|(^|\.)fb\.(com|me)$|^fb$/, 'social'],
  ['TikTok', /tiktok/, 'social'],
  ['Zalo', /zalo/, 'social'],
  ['YouTube', /youtube|(^|\.)youtu\.be$/, 'social'],
  ['Threads', /threads/, 'social'],
  ['LinkedIn', /linkedin|(^|\.)lnkd\.in$/, 'social'],
  ['X (Twitter)', /twitter|(^|\.)x\.com$|(^|\.)t\.co$/, 'social'],
  ['LINE', /(^|\.)line\.me$|^line$/, 'social'],
  ['Google', /(^|\.)google(\.[a-z]{2,3}){1,2}$|^google$/, 'search'],
  ['Bing', /(^|\.)bing\.com$|^bing$/, 'search'],
  ['Cốc Cốc', /coccoc/, 'search'],
  ['Yahoo', /yahoo/, 'search'],
  ['DuckDuckGo', /duckduckgo/, 'search'],
].map(([source, pattern, group]) => ({
  source: source as string,
  pattern: pattern as RegExp,
  group: group as TrafficGroup,
}));

const ANDROID_APPS: Record<string, TrafficSource> = {
  'com.google.android.gm': { group: 'referral', source: 'Gmail' },
  'com.google.android.googlequicksearchbox': {
    group: 'search',
    source: 'Google',
  },
  'com.google.android.youtube': { group: 'social', source: 'YouTube' },
  'com.facebook.katana': { group: 'social', source: 'Facebook' },
  'com.facebook.lite': { group: 'social', source: 'Facebook' },
  'com.facebook.orca': { group: 'social', source: 'Messenger' },
  'com.instagram.android': { group: 'social', source: 'Instagram' },
  'com.zhiliaoapp.musically': { group: 'social', source: 'TikTok' },
  'com.ss.android.ugc.trill': { group: 'social', source: 'TikTok' },
  'com.zing.zalo': { group: 'social', source: 'Zalo' },
  'jp.naver.line.android': { group: 'social', source: 'LINE' },
  'com.openai.chatgpt': { group: 'ai', source: 'ChatGPT' },
};

const IN_APP: { source: string; pattern: RegExp }[] = [
  {
    source: 'Messenger',
    pattern: /FBAN\/Messenger|Orca-Android|MessengerLite/i,
  },
  { source: 'Instagram', pattern: /Instagram/i },
  { source: 'Facebook', pattern: /FBAN|FBAV|FB_IAB|FB4A/ },
  { source: 'TikTok', pattern: /musical_ly|BytedanceWebview|TikTok/i },
  { source: 'Zalo', pattern: /Zalo/i },
  { source: 'LINE', pattern: /\bLine\//i },
];

const PAID_MEDIUM = /^(cpc|ppc|paid|ads?|cpm|paidsocial|paid[-_ ]\w+)$/i;

const find = (list: Known[], value?: string | null): Known | undefined => {
  const text = (value ?? '').toLowerCase();
  return text ? list.find((known) => known.pattern.test(text)) : undefined;
};

/** Which network a Facebook-family click came through. */
function metaSource(signals: TrafficSignals, userAgent: string): string {
  const named =
    find(PLACES, signals.referrer)?.source ??
    find(PLACES, signals.utmSource)?.source ??
    IN_APP.find((app) => app.pattern.test(userAgent))?.source;
  return named === 'Instagram' || named === 'Messenger' ? named : 'Facebook';
}

/** Name the source; the first sign that says something wins. */
export function classifyTraffic(
  signals: TrafficSignals,
  userAgent?: string | null,
): TrafficSource {
  const ua = userAgent ?? '';
  const ids = new Set(signals.clickIds ?? []);
  const referrer = (signals.referrer ?? '').toLowerCase();
  const paid = PAID_MEDIUM.test(signals.utmMedium ?? '');

  if (signals.partnerLink) return { group: 'partner', source: 'Link đối tác' };

  // Click ids only an advertiser's click carries.
  if (ids.has('gclid') || ids.has('gbraid') || ids.has('wbraid')) {
    return { group: 'ads', source: 'Google Ads' };
  }
  if (ids.has('dclid')) return { group: 'ads', source: 'Google Ads' };
  if (ids.has('ttclid')) return { group: 'ads', source: 'TikTok Ads' };
  if (ids.has('msclkid')) return { group: 'ads', source: 'Microsoft Ads' };

  const assistant =
    find(AI, signals.utmSource) ?? find(AI, referrer.split('://').pop());
  if (assistant) return { group: 'ai', source: assistant.source };

  // Facebook marks every link it opens, so its id alone does not mean an ad.
  if (ids.has('fbclid')) {
    const network = metaSource(signals, ua);
    return paid
      ? { group: 'ads', source: `${network} Ads` }
      : { group: 'social', source: network };
  }
  if (ids.has('igshid')) return { group: 'social', source: 'Instagram' };
  if (ids.has('twclid')) return { group: 'social', source: 'X (Twitter)' };
  if (ids.has('li_fat_id')) return { group: 'social', source: 'LinkedIn' };

  const utmSource = signals.utmSource?.trim();
  if (utmSource) {
    const known = find(PLACES, utmSource);
    if (paid) {
      return { group: 'ads', source: `${known?.source ?? utmSource} Ads` };
    }
    if (known) return { group: known.group, source: known.source };
    if (/e-?mail|newsletter/i.test(`${utmSource} ${signals.utmMedium ?? ''}`)) {
      return { group: 'referral', source: 'Email' };
    }
    return { group: 'referral', source: `UTM: ${utmSource}` };
  }

  if (referrer.startsWith('android-app://')) {
    const app = referrer.slice('android-app://'.length);
    return (
      ANDROID_APPS[app] ?? { group: 'referral', source: `Ứng dụng: ${app}` }
    );
  }
  if (referrer) {
    const place = find(PLACES, referrer);
    if (place?.source === 'Google' && signals.textFragment) {
      return { group: 'search', source: 'Google (đoạn trích / AI Overview)' };
    }
    if (place) return { group: place.group, source: place.source };
    return { group: 'referral', source: `Web: ${referrer}` };
  }
  if (ids.has('srsltid')) return { group: 'search', source: 'Google' };
  if (signals.textFragment) {
    return { group: 'search', source: 'Google (đoạn trích / AI Overview)' };
  }

  const app = IN_APP.find((candidate) => candidate.pattern.test(ua));
  if (app) return { group: 'social', source: app.source };

  // No referrer: typed in, or a link that hid where it was.
  if (signals.secFetchSite === 'none') {
    return { group: 'direct', source: 'Trực tiếp (tự tìm đến)' };
  }
  if (signals.secFetchSite === 'cross-site') {
    return { group: 'hidden', source: 'Từ link, không rõ nơi' };
  }
  return { group: 'unknown', source: 'Không rõ' };
}

const word = (value?: string | null): string | null => {
  const text = value?.trim().slice(0, 80);
  // A word with an address in it is somebody's details.
  return text && !/@|%40/.test(text) ? text : null;
};

/** Only what is on the list, in the shape expected; the rest is dropped. */
export function cleanTrafficSignals(raw: TrafficSignals): TrafficSignals {
  const referrer = (raw.referrer ?? '').trim().toLowerCase().slice(0, 120);
  const clean: TrafficSignals = {
    referrer: /^(android-app:\/\/)?[a-z0-9.-]+$/.test(referrer)
      ? referrer
      : null,
    utmSource: word(raw.utmSource),
    utmMedium: word(raw.utmMedium),
    utmCampaign: word(raw.utmCampaign),
    clickIds: (raw.clickIds ?? []).filter((id) =>
      (CLICK_IDS as readonly string[]).includes(id),
    ),
    secFetchSite: ['none', 'cross-site', 'same-site', 'same-origin'].includes(
      raw.secFetchSite ?? '',
    )
      ? raw.secFetchSite
      : null,
    textFragment: raw.textFragment === true,
    partnerLink: raw.partnerLink === true,
  };
  return clean;
}

/** The columns of an order; empty when the storefront sent nothing. */
export function orderTrafficFields(
  raw: TrafficSignals | null | undefined,
  userAgent?: string | null,
): {
  trafficSource: string | null;
  trafficGroup: TrafficGroup | null;
  trafficDetail: TrafficSignals | null;
} {
  if (!raw) {
    return { trafficSource: null, trafficGroup: null, trafficDetail: null };
  }
  const signals = cleanTrafficSignals(raw);
  const { group, source } = classifyTraffic(signals, userAgent);
  return {
    trafficSource: source.slice(0, 120),
    trafficGroup: group,
    trafficDetail: signals,
  };
}
