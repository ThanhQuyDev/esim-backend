/**
 * "Cấu hình thương hiệu" of a distribution partner (doitac-1410 #044).
 *
 * What the partner sets is stored as-is on `partner.brandInfo` (jsonb); this
 * file is the one place that reads it, so the portal, the eSIM email and the
 * QR code all agree on the defaults. Pure functions — no database.
 */

export type LogoPosition = 'left' | 'center' | 'right';

export type PartnerBrand = {
  /** "Tên thương hiệu". */
  displayName: string;
  logoUrl: string;
  logoPosition: LogoPosition;
  /** "Khẩu hiệu thương hiệu". */
  tagline: string;
  /** "Trang web chính thức". */
  website: string;
  /** "Email hỗ trợ". */
  supportEmail: string;
  /** "Màu chủ đạo": links and the install button of the email. */
  primaryColor: string;
  /** Show "Kiểm tra dung lượng & ưu đãi của eSIM" in the eSIM email. */
  showUsageCheck: boolean;
  /** Show "Hướng dẫn cài đặt eSIM" in the eSIM email. */
  showInstallGuide: boolean;
};

export const DEFAULT_PRIMARY_COLOR = '#000000';

const POSITIONS: LogoPosition[] = ['left', 'center', 'right'];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/** An http(s) URL, or '' — anything else ("javascript:", bare words) is dropped. */
function httpUrl(value: unknown): string {
  const raw = text(value, 500);
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

/** The brand with every default filled in, whatever was stored. */
export function readPartnerBrand(info: unknown): PartnerBrand {
  const raw = (info && typeof info === 'object' ? info : {}) as Record<
    string,
    unknown
  >;
  const position = raw.logoPosition as LogoPosition;
  const color = text(raw.primaryColor, 7);
  const email = text(raw.supportEmail, 200);
  return {
    displayName: text(raw.displayName, 120),
    logoUrl: httpUrl(raw.logoUrl),
    logoPosition: POSITIONS.includes(position) ? position : 'center',
    tagline: text(raw.tagline, 200),
    website: httpUrl(raw.website),
    supportEmail: EMAIL.test(email) ? email : '',
    primaryColor: HEX_COLOR.test(color) ? color : DEFAULT_PRIMARY_COLOR,
    // Both blocks were always in the email; a partner switches them off.
    showUsageCheck: raw.showUsageCheck !== false,
    showInstallGuide: raw.showInstallGuide !== false,
  };
}

/**
 * What is saved from the portal form: the same normalisation, so a bad value
 * never reaches the email. An invalid website or email is refused rather than
 * silently dropped, so the partner sees why it did not stick.
 */
export function sanitizeBrandInput(input: unknown): PartnerBrand {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
  const brand = readPartnerBrand(raw);
  if (text(raw.website, 500) && !brand.website) {
    throw new Error('Trang web chính thức không hợp lệ.');
  }
  if (text(raw.supportEmail, 200) && !brand.supportEmail) {
    throw new Error('Email hỗ trợ không hợp lệ.');
  }
  if (
    text(raw.primaryColor, 20) &&
    !HEX_COLOR.test(text(raw.primaryColor, 20))
  ) {
    throw new Error('Màu chủ đạo không hợp lệ.');
  }
  return brand;
}

/**
 * Whether the server may download this logo to draw it in the QR code: only a
 * file our own upload stored (on this API, or in our S3 bucket). Fetching any
 * URL a partner typed would let them make the server call internal addresses.
 */
export function isOwnFileUrl(
  url: string,
  opts: { backendDomain?: string; s3Bucket?: string; s3Region?: string },
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (opts.backendDomain) {
    try {
      const own = new URL(opts.backendDomain);
      if (
        parsed.host === own.host &&
        /\/api\/v1\/files[\\/]/.test(decodeURIComponent(parsed.pathname))
      ) {
        return true;
      }
    } catch {
      /* not a URL — fall through */
    }
  }
  if (opts.s3Bucket) {
    const hosts = [
      `${opts.s3Bucket}.s3.amazonaws.com`,
      ...(opts.s3Region
        ? [`${opts.s3Bucket}.s3.${opts.s3Region}.amazonaws.com`]
        : []),
    ];
    if (hosts.includes(parsed.host)) return true;
  }
  return false;
}
