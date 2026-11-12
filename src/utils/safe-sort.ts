import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * SECURITY 12/11/2026 — `?sort=[{"orderBy":…}]` went straight into ORDER BY
 * (`qb.addOrderBy(\`blog.${sort.orderBy}\`)`), a SQL injection on public lists
 * (blogs, why-choose-us, footers) and on every customer's order list.
 *
 * Only a property the entity really has is sorted on; anything else is
 * dropped. The direction is ASC unless it says DESC.
 */
export function applySafeSort<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  sortOptions: { orderBy?: unknown; order?: unknown }[] | null | undefined,
  opts: { quoted?: boolean } = {},
): boolean {
  if (!Array.isArray(sortOptions) || !sortOptions.length) return false;
  const metadata = qb.expressionMap.findAliasByName(alias).metadata;
  let applied = false;
  for (const sort of sortOptions) {
    if (typeof sort?.orderBy !== 'string') continue;
    const column = metadata.findColumnWithPropertyPath(sort.orderBy);
    if (!column || column.relationMetadata) continue;
    const direction =
      String(sort.order ?? '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.addOrderBy(
      opts.quoted
        ? `"${alias}"."${column.databaseName}"`
        : `${alias}.${column.propertyPath}`,
      direction,
    );
    applied = true;
  }
  return applied;
}
