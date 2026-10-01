/**
 * WHERE fragment for the free-text `providers` column that `destination` and
 * `region` both carry (#034, #036).
 *
 * The column is filled in by hand — comma-separated, and with no guarantee
 * whether an admin typed the slug (`airalo`) or the display name (`Airalo`) — so
 * there is nothing to join or compare exactly against. Each requested supplier
 * becomes a case-insensitive substring and the row qualifies if it mentions ANY
 * of them: picking two suppliers must widen the result, not narrow it to rows
 * served by both.
 *
 * Returns `null` when there is nothing to filter on. Blank entries are dropped
 * rather than matched: `''` would become `ILIKE '%%'` and quietly return the
 * whole catalogue.
 */
export function buildProvidersTextFilter(
  alias: string,
  providers: string[] | null | undefined,
): { sql: string; params: Record<string, string> } | null {
  const tokens = (providers ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (!tokens.length) return null;

  const sql = tokens
    .map((_, i) => `${alias}.providers ILIKE :provider${i}`)
    .join(' OR ');

  const params = tokens.reduce<Record<string, string>>((acc, token, i) => {
    acc[`provider${i}`] = `%${token}%`;
    return acc;
  }, {});

  return { sql: `(${sql})`, params };
}
