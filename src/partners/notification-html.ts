/**
 * The body of a partner announcement is HTML from the admin's rich-text
 * editor (doitac-1410 #062). It is written by an admin, but it is shown to
 * every partner and mailed out, so what can run is taken out before it is
 * stored: scripts, frames, styles, event handlers and `javascript:` links.
 * The partner screens sanitise again on display.
 */

const DANGEROUS_BLOCKS =
  /<(script|style|iframe|object|embed|frameset|form|noscript|template)\b[\s\S]*?<\/\1\s*>/gi;
// Whatever is left of them unpaired, and the empty ones.
const DANGEROUS_TAGS =
  /<\/?(script|style|iframe|object|embed|frame|frameset|form|noscript|template|meta|link|base)\b[^>]*>/gi;
const EVENT_ATTRS = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SCRIPT_URLS =
  /\s+(href|src|xlink:href|action|formaction)\s*=\s*("\s*(javascript|vbscript|data):[^"]*"|'\s*(javascript|vbscript|data):[^']*'|(javascript|vbscript|data):[^\s>]*)/gi;

export function sanitizeNotificationHtml(input: string): string {
  let html = String(input ?? '');
  // Twice, so a tag split around a removed one cannot reassemble.
  for (let i = 0; i < 2; i++) {
    html = html
      .replace(DANGEROUS_BLOCKS, '')
      .replace(DANGEROUS_TAGS, '')
      .replace(EVENT_ATTRS, '')
      .replace(SCRIPT_URLS, '');
  }
  return html.trim();
}

/** Whether a stored body is HTML, or plain text from before the editor. */
export function isHtmlBody(body: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(body ?? '');
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The body as email HTML: old plain-text ones keep their line breaks. */
export function notificationBodyHtml(body: string): string {
  if (isHtmlBody(body)) return sanitizeNotificationHtml(body);
  return escapeHtml(body ?? '').replace(/\r?\n/g, '<br>');
}

/** The body as plain text, for the email's text part and previews. */
export function notificationBodyText(body: string): string {
  if (!isHtmlBody(body)) return body ?? '';
  return body
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
