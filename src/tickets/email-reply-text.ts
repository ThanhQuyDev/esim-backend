/**
 * The part of an email reply the customer actually wrote (#059).
 *
 * A reply arrives with the entire previous message quoted underneath it, plus a
 * signature. Storing that verbatim would make the ticket thread unreadable after
 * two exchanges, so the quoted history is cut off.
 *
 * Deliberately conservative: when no boundary is recognised the whole body is
 * kept. Losing what a customer wrote is far worse than leaving a quote in.
 */

/**
 * Lines that begin the quoted history. Vietnamese and English, because the
 * client's locale decides the wording, not ours.
 */
const QUOTE_HEADERS: RegExp[] = [
  // "On Mon, 1 Jan 2026 at 10:00, Support <x@y> wrote:"
  /^\s*On .+ wrote:\s*$/i,
  // "Vào ... đã viết:" / "Vào Th 2, ... <x@y> đã viết:"
  /^\s*Vào .+ đã viết:\s*$/i,
  // Outlook's block header, either language.
  /^\s*-{2,}\s*(Original Message|Thư gốc|Tin nhắn gốc)\s*-{2,}\s*$/i,
  /^\s*_{5,}\s*$/,
  // "From: support@..." / "Từ: support@..." as the first line of a forwarded block.
  /^\s*(From|Từ):\s*.+$/i,
  // Gmail mobile's "---------- Forwarded message ---------"
  /^\s*-{5,}\s*(Forwarded message|Thư đã chuyển tiếp)\s*-{5,}\s*$/i,
];

/** Signature separator, per RFC 3676: a line of exactly "-- ". */
const SIGNATURE = /^-{2}\s?$/;

/**
 * Our own templates end with this line, so a reply that quotes the whole mail
 * can be cut at it even when the client used an unfamiliar quote header.
 */
const OUR_FOOTER = /Bạn có thể trả lời trực tiếp email này/i;

export function extractReplyText(body: string | null | undefined): string {
  if (!body) return '';

  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    if (QUOTE_HEADERS.some((pattern) => pattern.test(line))) break;
    if (SIGNATURE.test(line)) break;
    if (OUR_FOOTER.test(line)) break;
    // A run of ">" quoting with nothing before it is quoted history too; a reply
    // that starts with it has nothing of its own above, so stop.
    if (/^\s*>/.test(line) && kept.some((entry) => entry.trim().length > 0))
      break;
    kept.push(line);
  }

  const text = kept.join('\n').trim();

  // Everything looked like quoting — keep the original rather than storing an
  // empty reply.
  return text.length > 0 ? text : body.trim();
}
