import { SlidingWindowLimiter } from '../tickets/ticket-spam-guard';

/**
 * Chat without an account (vande-2011 #023).
 *
 * A visitor gets a key from the server, signed with a secret of its own so a
 * visitor token can never pass for a login token or the other way round. On
 * the wire the visitor stands in as the user {@link GUEST_SENDER_ID}: their
 * room's `userId` and their messages' `senderId`. That id is never an
 * account, and a room belongs to a visitor only through the key they hold
 * (see ChatGateway.ownsRoom), never through that shared id.
 *
 * What stops abuse, since anyone can now open the socket:
 * - new visitor keys per IP address, and new conversations per IP address;
 * - messages per visitor and per IP address, per minute and per hour;
 * - a visitor's message: text only (no files, so no new upload path), at most
 *   {@link GUEST_MAX_LENGTH} characters, no links and no HTML;
 * - the CORS allowlist of the socket (esim sites only) stays as it is.
 */
export const GUEST_SENDER_ID = -1;

export const GUEST_TOKEN_TTL = '90d';
export const GUEST_MAX_LENGTH = 1000;

/** Secret for visitor tokens: never the one that signs logins. */
export function guestSecret(authSecret: string): string {
  return `${authSecret}:chat-guest`;
}

export const guestLimits = {
  /** New visitor keys one IP address may get. */
  mintPerIp: new SlidingWindowLimiter(20, 60 * 60 * 1000),
  /** New conversations one IP address may open. */
  roomsPerIp: new SlidingWindowLimiter(10, 60 * 60 * 1000),
  messagesPerGuestMinute: new SlidingWindowLimiter(8, 60 * 1000),
  messagesPerGuestHour: new SlidingWindowLimiter(60, 60 * 60 * 1000),
  messagesPerIpMinute: new SlidingWindowLimiter(30, 60 * 1000),
};

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const LINK =
  /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|info|biz|xyz|top|io|co|vn|ru|cn|link|click|site|online|shop|store|me|ly|gl|tk|ml|ga|cf|gq|cc|ws|app|dev|page|live|club|vip|bet|win|pro)\b)/i;
const HTML = /<\s*\/?\s*[a-z!][^>]*>/i;

/**
 * Why a visitor's message is refused, or null when it may go. An email address
 * is not a link: a visitor may well leave theirs for a reply.
 */
export function guestMessageProblem(text: string): string | null {
  const body = text.trim();
  if (!body) return 'Tin nhắn trống.';
  if (body.length > GUEST_MAX_LENGTH) {
    return `Tin nhắn dài quá ${GUEST_MAX_LENGTH} ký tự.`;
  }
  if (HTML.test(body)) return 'Tin nhắn không được chứa mã HTML.';
  if (LINK.test(body.replace(EMAIL, ''))) {
    return 'Vui lòng đăng nhập để gửi đường link.';
  }
  return null;
}
