/**
 * The order an admin typed a blog post's plan ids in (#057).
 *
 * Plans are linked through the `blog_plans` join table, which has no position
 * column, so the post showed its plans in whatever order the database returned.
 * The typed order is now stored on the blog (`planOrder`) and applied whenever
 * the plans are read.
 */

export function parsePlanOrder(raw?: string[] | string | null): number[] {
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  return parts
    .map((value) => Number(String(value).trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

/** Ids in the order given, each once; null when there are none. */
export function serializePlanOrder(
  plans: { id: number | string }[] | null | undefined,
): string[] | null {
  const ids: string[] = [];
  for (const plan of plans ?? []) {
    const id = Number(plan?.id);
    if (Number.isInteger(id) && id > 0 && !ids.includes(String(id))) {
      ids.push(String(id));
    }
  }
  return ids.length ? ids : null;
}

/**
 * Put items in the stored order. Anything not in it (an old post saved before
 * the order was kept) follows, in the order it came.
 */
export function sortByPlanOrder<T extends { id: number | string }>(
  items: T[] | undefined,
  order: number[],
): T[] | undefined {
  if (!items || !order.length) return items;
  const position = new Map(order.map((id, index) => [id, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const pa = position.get(Number(a.item.id)) ?? Number.POSITIVE_INFINITY;
      const pb = position.get(Number(b.item.id)) ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa < pb ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
