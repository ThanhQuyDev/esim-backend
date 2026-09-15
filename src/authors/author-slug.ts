/**
 * The URL slug for an author name: accents and đ stripped, everything else
 * hyphenated. The storefront builds author links the same way, so a slug made
 * here and a link made there always agree.
 */
export function toAuthorSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
