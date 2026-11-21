import { randomBytes } from 'crypto';
import { SlidingWindowLimiter } from '../tickets/ticket-spam-guard';

/**
 * Hand-off of a device check from a computer to a phone (vande-2011 #031,
 * spec section 10): the computer shows a QR code with a token, the phone that
 * scans it checks itself and posts the result, the computer picks it up.
 *
 * The token is random, used once and lives ten minutes; nothing personal is
 * kept — only the verdict and the device name the phone's browser gave. In
 * memory: a token lost to a restart just means "scan again".
 */
export const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_SESSIONS = 20_000;

export type DeviceCheckState = 'ok' | 'no' | 'unk';

export type DeviceCheckResult = {
  state: DeviceCheckState;
  /** "iPhone", "Samsung Galaxy S24 Ultra · Android 16". */
  name: string;
  /** "SM-S928B" when the browser gave one. */
  model?: string | null;
};

type Session = {
  expiresAt: number;
  result: DeviceCheckResult | null;
};

export class DeviceCheckStore {
  private readonly sessions = new Map<string, Session>();
  /** Codes a computer may ask for: one per page view is plenty. */
  readonly createPerIp = new SlidingWindowLimiter(30, 60 * 60 * 1000);
  /** Results a phone may send. */
  readonly resultPerIp = new SlidingWindowLimiter(30, 60 * 60 * 1000);

  create(now = Date.now()): { token: string; expiresAt: number } {
    this.sweep(now);
    if (this.sessions.size >= MAX_SESSIONS) {
      // Oldest first: a Map keeps insertion order.
      const first = this.sessions.keys().next().value;
      if (first) this.sessions.delete(first);
    }
    const token = randomBytes(16).toString('base64url');
    const expiresAt = now + SESSION_TTL_MS;
    this.sessions.set(token, { expiresAt, result: null });
    return { token, expiresAt };
  }

  /** The phone's verdict; refused for an unknown, expired or used token. */
  submit(token: string, result: DeviceCheckResult, now = Date.now()): boolean {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= now || session.result) return false;
    session.result = result;
    return true;
  }

  /** What the computer sees. A delivered result ends the session. */
  read(
    token: string,
    now = Date.now(),
  ): { status: 'waiting' | 'done' | 'expired'; result?: DeviceCheckResult } {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= now) {
      this.sessions.delete(token);
      return { status: 'expired' };
    }
    if (!session.result) return { status: 'waiting' };
    this.sessions.delete(token);
    return { status: 'done', result: session.result };
  }

  private sweep(now: number) {
    for (const [token, s] of this.sessions) {
      if (s.expiresAt <= now) this.sessions.delete(token);
    }
  }
}
