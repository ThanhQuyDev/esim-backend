import { sanitizeNotificationHtml } from '../partners/notification-html';

/**
 * The "Ghi chú" shown above a destination / region page on the website
 * (doitac-1410 #078): rich text from the admin's editor (bold, italic,
 * underline, links). What can run is taken out before it is stored, and an
 * editor left empty (`<p></p>`) clears the note.
 *
 * `undefined` means "not sent", so an update without it leaves the note alone.
 */
export function normaliseNoticeHtml(
  input: string | null | undefined,
): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  const html = sanitizeNotificationHtml(input);
  const text = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return text ? html : null;
}
