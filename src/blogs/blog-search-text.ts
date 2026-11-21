/**
 * Blog search that ignores case and Vietnamese marks (vande-2011 #044, row 57):
 * "Trung Quốc", "trung quốc" and "Trung quoc" find the same posts, in the
 * title, the excerpt or the body.
 *
 * Done with Postgres `translate()` rather than the `unaccent` extension, which
 * the databases do not have installed.
 */
const MARKED =
  'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
const PLAIN =
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

/** Lower case, without marks, spaces collapsed. */
export function plainSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** SQL for `column` lower-cased and without marks, to compare with LIKE. */
export function plainSqlText(column: string): string {
  return `translate(lower(${column}), '${MARKED}', '${PLAIN}')`;
}

/** A LIKE pattern for the text: `%` and `_` typed by the reader are literal. */
export function plainLikePattern(text: string): string {
  return `%${plainSearchText(text).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The columns a reader's search looks in. */
export const BLOG_SEARCH_COLUMNS = [
  'blog.title',
  'blog.excerpt',
  'blog.content',
  'blog.category',
  'blog.parent',
];
