import { lookup } from 'fast-geoip';

/**
 * Where an order came from, for "Vị trí & IP" on the admin order page
 * (vande #058).
 *
 * Looked up once, when the order is placed, from a database shipped with the
 * app (GeoLite2 via fast-geoip): the buyer's address is never sent to an
 * outside service, and reading it costs a few small file reads, not memory.
 */

/** The address as the buyer's network gave it, or null when it is not one. */
export function publicIp(ip?: string | null): string | null {
  const value = (ip ?? '').trim().replace(/^::ffff:/i, '');
  if (!value || value === 'unknown') return null;
  // Loopback and private ranges say where our proxy is, not the buyer.
  if (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(value) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(value) ||
    /^(::1$|fc|fd|fe80:)/i.test(value)
  ) {
    return null;
  }
  return value;
}

const COUNTRY = new Intl.DisplayNames(['en'], { type: 'region' });

/** Country code and city of a public address (vande #059), or null. */
export async function ipPlace(
  ip?: string | null,
): Promise<{ country: string; city: string | null } | null> {
  const address = publicIp(ip);
  if (!address) return null;
  try {
    const found = await lookup(address);
    return found?.country
      ? { country: found.country, city: found.city || null }
      : null;
  } catch {
    return null;
  }
}

/** "Vietnam" for "VN"; the code itself when the name is not known. */
export function countryName(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Ho Chi Minh City, Vietnam" — null when the address is unknown. */
export async function ipLocation(ip?: string | null): Promise<string | null> {
  const address = publicIp(ip);
  if (!address) return null;
  try {
    const found = await lookup(address);
    if (!found?.country) return null;
    let country: string = found.country;
    try {
      country = COUNTRY.of(found.country) ?? found.country;
    } catch {
      // An unusual code stays as it is.
    }
    return [found.city, country].filter(Boolean).join(', ');
  } catch {
    return null;
  }
}
