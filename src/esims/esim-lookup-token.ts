import * as crypto from 'crypto';

/**
 * Tokens for the public "Tra cứu eSIM" page (#003).
 *
 * The customer follows a link to check the data left on an eSIM without signing
 * in, and that link is also forwarded to family, so it must not carry the ICCID:
 * an ICCID is enough to order a topup for someone else's eSIM. The token carries
 * the internal eSIM id instead, signed so nobody can walk the id space.
 *
 * Stateless on purpose — the same token comes out of the eSIM delivery email and
 * out of the web form, with no column to migrate and nothing to keep in sync.
 * The eSIM's own `qrAccessToken` is deliberately NOT reused: that one fetches the
 * installable QR code, and a usage link people forward must never grant that.
 */

const SIGNATURE_BYTES = 16;

function lookupSecret(): string {
  // AUTH_JWT_SECRET is always set where the API runs, so the feature needs no
  // new variable in .env.prod; ESIM_LOOKUP_SECRET exists to rotate lookup links
  // on their own, without signing every user out.
  const secret = process.env.ESIM_LOOKUP_SECRET || process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error(
      'ESIM_LOOKUP_SECRET or AUTH_JWT_SECRET must be set to sign eSIM lookup links',
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto
    .createHmac('sha256', lookupSecret())
    .update(payload)
    .digest('base64url')
    .slice(0, Math.ceil((SIGNATURE_BYTES * 4) / 3));
}

/** Signed, ICCID-free handle on one eSIM, safe to put in a URL. */
export function createEsimLookupToken(esimId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ e: esimId, t: Math.floor(Date.now() / 1000) }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/**
 * eSIM id inside a lookup token, or null when the token is malformed or the
 * signature does not match. Never throws: it runs on unvalidated query strings.
 *
 * Tokens do not expire — a traveller checks the link throughout the trip, and
 * the eSIM's own expiry is what the page reports.
 */
export function parseEsimLookupToken(token: string | undefined): number | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8'),
    ) as { e?: unknown };
    const esimId = Number(decoded.e);
    return Number.isInteger(esimId) && esimId > 0 ? esimId : null;
  } catch {
    return null;
  }
}

/**
 * ICCID as the lookup page shows it: last 4 digits only. Whoever opens a
 * forwarded link should see enough to recognise the eSIM, not enough to act on
 * it.
 */
export function maskIccid(iccid: string | null | undefined): string | null {
  if (!iccid) return null;
  const tail = iccid.slice(-4);
  return `${'•'.repeat(Math.max(0, iccid.length - 4))}${tail}`;
}
