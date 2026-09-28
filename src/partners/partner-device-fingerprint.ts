import { createHash } from 'crypto';

/**
 * A server-side device fingerprint for a click (#039).
 *
 * The click id in the redirect URL is the main mechanism, but a URL can be
 * stripped by a share sheet or an in-app browser. This is the backstop: the
 * server already sees the network address and the user agent on both the click
 * and the order, and hashing the pair gives something comparable that never
 * touched the browser's cookie jar.
 *
 * Not identifying and not a location record — a hash of a hash and a UA string,
 * used to match one visit to one order.
 *
 * The two sides hash the address to different lengths (`/go` sends the full
 * sha256, the order stores its first 32 characters), so the address part is
 * always narrowed to 32 characters first. Same input, same value on both sides.
 */
export function partnerDeviceFingerprint(
  ipHash?: string | null,
  userAgent?: string | null,
): string | null {
  const ip = ipHash?.trim().slice(0, 32);
  const ua = userAgent?.trim();
  // One signal on its own is far too broad to attribute an order on.
  if (!ip || !ua) return null;

  return createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 40);
}
