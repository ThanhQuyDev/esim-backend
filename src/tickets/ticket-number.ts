/**
 * The support-ticket reference a customer sees (#059).
 *
 * `HT-000123` — "hỗ trợ", zero-padded, derived from the row id so it needs no
 * sequence and can be backfilled exactly. It goes in the subject line of every
 * support email, and it is what a reply has to be matched back to, so the format
 * is deliberately narrow and parsed as such.
 */

const PREFIX = 'HT-';
const DIGITS = 6;

export function ticketNumberFor(id: number): string {
  return `${PREFIX}${String(id).padStart(DIGITS, '0')}`;
}

/**
 * The ticket number mentioned in a subject line, or null.
 *
 * Tolerant of what mail clients do to a subject — `Re:`, `Fwd:`, added
 * whitespace, the brackets the template puts around it — because a reply's
 * subject is rarely the one that was sent.
 */
export function parseTicketNumber(
  subject: string | null | undefined,
): string | null {
  if (!subject) return null;
  const match = /HT-(\d{4,10})/i.exec(subject);
  if (!match) return null;
  return `${PREFIX}${match[1].padStart(DIGITS, '0')}`;
}
