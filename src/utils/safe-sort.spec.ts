import { applySafeSort } from './safe-sort';

/** SECURITY 12/11/2026 — SQL injection through ?sort=. */
function fakeQb(columns: Record<string, string>) {
  const addOrderBy = jest.fn();
  const qb = {
    addOrderBy,
    expressionMap: {
      findAliasByName: () => ({
        metadata: {
          findColumnWithPropertyPath: (path: string) =>
            path in columns
              ? { propertyPath: path, databaseName: columns[path] }
              : undefined,
        },
      }),
    },
  };
  return { qb: qb as never, addOrderBy };
}

describe('applySafeSort', () => {
  it('should sort on a real column', () => {
    const { qb, addOrderBy } = fakeQb({ createdAt: 'createdAt' });
    expect(
      applySafeSort(qb, 'blog', [{ orderBy: 'createdAt', order: 'desc' }]),
    ).toBe(true);
    expect(addOrderBy).toHaveBeenCalledWith('blog.createdAt', 'DESC');
  });

  it('should drop anything that is not a column', () => {
    const { qb, addOrderBy } = fakeQb({ id: 'id' });
    const applied = applySafeSort(qb, 'blog', [
      { orderBy: 'id,(SELECT pg_sleep(3))', order: 'ASC' },
      { orderBy: 'id" DESC, (SELECT 1)--', order: 'ASC' },
      { orderBy: { x: 1 }, order: 'ASC' },
    ]);
    expect(applied).toBe(false);
    expect(addOrderBy).not.toHaveBeenCalled();
  });

  it('should never pass a made-up direction on', () => {
    const { qb, addOrderBy } = fakeQb({ id: 'id' });
    applySafeSort(qb, 'order', [
      { orderBy: 'id', order: 'ASC, (SELECT pg_sleep(3))' },
    ]);
    expect(addOrderBy).toHaveBeenCalledWith('order.id', 'ASC');
  });

  it('should quote the database column name when asked', () => {
    const { qb, addOrderBy } = fakeQb({ isPublished: 'isPublished' });
    applySafeSort(qb, 'helpCenter', [{ orderBy: 'isPublished' }], {
      quoted: true,
    });
    expect(addOrderBy).toHaveBeenCalledWith(
      '"helpCenter"."isPublished"',
      'ASC',
    );
  });
});
