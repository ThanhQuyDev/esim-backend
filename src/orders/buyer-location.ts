import { open, Reader } from 'maxmind';

/**
 * Where an order came from, for "Vị trí & IP" on the admin order page
 * (vande #058).
 *
 * Looked up once, when the order is placed, from a database shipped with the
 * app: the buyer's address is never sent to an outside service.
 *
 * GeoLite2 from the `@ip-location-db` package (vande-0411 #051). `fast-geoip`
 * stopped at July 2022, and Vietnamese networks move their blocks between
 * cities: a Ho Chi Minh City address came out as Quảng Ngãi. Keep this package
 * current, an old copy goes wrong the same way.
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

type Place = { country_code?: string; city?: string };

const DATABASE = '@ip-location-db/geolite2-city-mmdb/geolite2-city';
const readers = new Map<string, Promise<Reader<any>>>();

/** Opened on first use, each file once: IPv6 is rarely needed. */
function readerFor(ipv6: boolean): Promise<Reader<any>> {
  const file = `${DATABASE}-${ipv6 ? 'ipv6' : 'ipv4'}.mmdb`;
  let reader = readers.get(file);
  if (!reader) {
    reader = open<any>(require.resolve(file));
    readers.set(file, reader);
  }
  return reader;
}

async function lookup(address: string): Promise<Place | null> {
  const reader = await readerFor(address.includes(':'));
  return reader.get(address) as Place | null;
}

/** Country code and city of a public address (vande #059), or null. */
export async function ipPlace(
  ip?: string | null,
): Promise<{ country: string; city: string | null } | null> {
  const address = publicIp(ip);
  if (!address) return null;
  try {
    const found = await lookup(address);
    return found?.country_code
      ? { country: found.country_code, city: found.city || null }
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
    if (!found?.country_code) return null;
    let country: string = found.country_code;
    try {
      country = COUNTRY.of(found.country_code) ?? found.country_code;
    } catch {
      // An unusual code stays as it is.
    }
    return [found.city, country].filter(Boolean).join(', ');
  } catch {
    return null;
  }
}
