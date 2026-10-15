/**
 * Accent-insensitive search for Vietnamese text.
 *
 * Admins type names without diacritics ("Dung", "Phuong"), and an ILIKE on the
 * raw column never matches "Dũng" or "Phượng". Postgres' `unaccent` extension is
 * not installed on our databases, so the folding is a plain `translate()` over
 * the Vietnamese letters, applied to both the column and the search term.
 */
const ACCENTED =
  'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const PLAIN =
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

/** SQL that folds `expr` to lower-case, accent-free text. */
export function vnFoldSql(expr: string): string {
  return `translate(lower(${expr}), '${ACCENTED}', '${PLAIN}')`;
}

/** The same folding in JS, for the search term. */
export function vnFold(value: string): string {
  const map = new Map([...ACCENTED].map((ch, i) => [ch, PLAIN[i]]));
  return [...value.toLowerCase()].map((ch) => map.get(ch) ?? ch).join('');
}
