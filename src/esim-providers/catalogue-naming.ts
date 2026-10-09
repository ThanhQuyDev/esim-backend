/**
 * Naming helpers shared by the supplier catalogue syncs (#003, test round 4).
 *
 * Billion and MicroEsim regional packs used to be named — and slugged — after
 * every country code they cover ("AE,AG,AI,AL…", `microesim-ae-ag-ai-…`), which
 * made the CMS "Điểm đến" column, the region slug and every plan slug hundreds
 * of characters long. The supplier's own pack name is short and readable
 * ("Global 126-Local-Total50GB-30-E0" → "Global 126"), so that is used instead.
 */

/** Lower-case, ASCII, dash-separated. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The location part of a supplier pack name: everything before the first
 * dash. "Global 126-Local-Total50GB-30-E0" → "Global 126",
 * "US/CA/MX-unlimited-3-A0" → "US/CA/MX".
 */
export function shortRegionName(packageName: string): string {
  return (packageName ?? '').split('-')[0].replace(/\s+/g, ' ').trim();
}

/** A region name a sync generated from the raw country-code list. */
export function isCountryCodeList(name: string): boolean {
  return /^[A-Z]{2}(?:\s*,\s*[A-Z]{2})+$/.test((name ?? '').trim());
}

/**
 * Carrier list for the "Mạng nội địa" line: each carrier once, in the order
 * given, without the "Auto" / "Auto connect" placeholders MicroEsim sends for
 * packs that pick whichever network is strongest. Null when nothing is left.
 */
export function uniqueOperators(
  names: Array<string | null | undefined>,
): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = (raw ?? '').trim();
    if (!name || /^auto(?:\s*connect)?$/i.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.length ? out.join(', ') : null;
}

/**
 * Network generations ("Tốc độ") from any mix of tokens such as "4G", "5G",
 * "LTE", "3G" — "3G/4G/5G", the format eSIM Access already uses. LTE counts as
 * 4G. Null when no generation is named.
 */
export function networkSpeed(
  tokens: Array<string | null | undefined>,
): string | null {
  const gens = new Set<number>();
  for (const token of tokens) {
    const text = (token ?? '').toUpperCase();
    for (const m of text.matchAll(/([2-5])G/g)) gens.add(Number(m[1]));
    if (/LTE/.test(text)) gens.add(4);
  }
  if (gens.size === 0) return null;
  return [...gens]
    .sort((a, b) => a - b)
    .map((g) => `${g}G`)
    .join('/');
}
