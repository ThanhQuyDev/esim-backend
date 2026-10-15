import { createHmac, timingSafeEqual } from 'crypto';

/**
 * A signed click token (doitac-1410 #026).
 *
 * The click id alone is a random string: nothing proves the server minted it,
 * so a browser could be handed any id at all. The token carries the id with an
 * HMAC over it and the id of the key that signed it, so a key can be rotated
 * without voiding the clicks already out there:
 *
 *   v1.<keyId>.<clickId>.<signature>
 *
 * Keys come from `PARTNER_CLICK_KEYS` ("k1:secret,k2:secret"), the one to sign
 * with from `PARTNER_CLICK_KEY_ID`. Without them a key derived from the JWT
 * secret is used ("k0"), so nothing new has to be configured to deploy.
 */

const VERSION = 'v1';
const CLICK_ID = /^[0-9a-f]{16,64}$/;

type Keyring = { current: string; keys: Map<string, string> };

function keyring(): Keyring {
  const keys = new Map<string, string>();
  for (const pair of (process.env.PARTNER_CLICK_KEYS ?? '').split(',')) {
    const at = pair.indexOf(':');
    if (at <= 0) continue;
    const id = pair.slice(0, at).trim();
    const secret = pair.slice(at + 1).trim();
    if (/^[a-z0-9]{1,16}$/i.test(id) && secret.length >= 16) {
      keys.set(id, secret);
    }
  }
  const base = process.env.AUTH_JWT_SECRET || 'esim-partner-click';
  keys.set(
    'k0',
    createHmac('sha256', base).update('partner-click-token').digest('hex'),
  );
  const wanted = process.env.PARTNER_CLICK_KEY_ID?.trim();
  return { current: wanted && keys.has(wanted) ? wanted : 'k0', keys };
}

function signature(secret: string, keyId: string, clickId: string): string {
  return createHmac('sha256', secret)
    .update(`${VERSION}.${keyId}.${clickId}`)
    .digest('base64url')
    .slice(0, 32);
}

export function signClickToken(clickId: string): string {
  const { current, keys } = keyring();
  return `${VERSION}.${current}.${clickId}.${signature(keys.get(current)!, current, clickId)}`;
}

/** Whether the value is shaped like a token at all (not a bare click id). */
export function isClickToken(value?: string | null): boolean {
  return Boolean(value?.startsWith(`${VERSION}.`));
}

/** The click id inside a genuine token, or null for anything forged. */
export function verifyClickToken(token?: string | null): string | null {
  const parts = token?.trim().split('.') ?? [];
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [, keyId, clickId, sig] = parts as [string, string, string, string];
  if (!CLICK_ID.test(clickId)) return null;
  const secret = keyring().keys.get(keyId);
  if (!secret) return null;
  const expected = Buffer.from(signature(secret, keyId, clickId));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? clickId
    : null;
}
