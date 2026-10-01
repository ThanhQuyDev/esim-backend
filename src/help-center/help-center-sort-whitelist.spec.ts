import {
  HelpCenterRelationalRepository,
  HELP_CENTER_SORTABLE_COLUMNS,
} from './infrastructure/persistence/relational/repositories/help-center.repository';

/**
 * #053 — the list gained a sortable "Ngày chỉnh sửa" column, which is the first
 * time this table's sort actually reaches the API.
 *
 * `sort.orderBy` is interpolated straight into the SQL identifier, so it is now
 * checked against the real columns. An unknown name must be dropped rather than
 * reaching the query: an admin's sort click cannot be allowed to produce a SQL
 * error, let alone smuggle anything into the identifier.
 */
describe('Help center sort whitelist (#053)', () => {
  function makeRepo() {
    const orderBys: { column: string; direction: string }[] = [];
    const qb: Record<string, jest.Mock> = {};
    const chain =
      (fn?: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        fn?.(...args);
        return qb;
      };

    qb.andWhere = jest.fn(chain());
    qb.where = jest.fn(chain());
    qb.select = jest.fn(chain());
    qb.addSelect = jest.fn(chain());
    qb.leftJoin = jest.fn(chain());
    qb.groupBy = jest.fn(chain());
    qb.skip = jest.fn(chain());
    qb.take = jest.fn(chain());
    qb.orderBy = jest.fn(
      chain((column, direction) =>
        orderBys.push({ column: String(column), direction: String(direction) }),
      ),
    );
    qb.addOrderBy = jest.fn(
      chain((column, direction) =>
        orderBys.push({ column: String(column), direction: String(direction) }),
      ),
    );
    qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
    qb.getCount = jest.fn().mockResolvedValue(0);
    qb.getMany = jest.fn().mockResolvedValue([]);

    const repo = new HelpCenterRelationalRepository({
      createQueryBuilder: () => qb,
    } as never);

    return { repo, orderBys };
  }

  async function orderBysFor(sortOptions: unknown) {
    const { repo, orderBys } = makeRepo();
    await repo.findAllWithPagination({
      filterOptions: null,
      sortOptions: sortOptions as never,
      paginationOptions: { page: 1, limit: 10 },
    });
    return orderBys;
  }

  it('should sorts by a known column', async () => {
    const orderBys = await orderBysFor([
      { orderBy: 'updatedAt', order: 'DESC' },
    ]);

    expect(orderBys).toEqual([
      { column: '"helpCenter"."updatedAt"', direction: 'DESC' },
    ]);
  });

  it('should allows every column the CMS list can sort on', () => {
    for (const column of ['title', 'order', 'updatedAt', 'createdAt']) {
      expect(HELP_CENTER_SORTABLE_COLUMNS.has(column)).toBe(true);
    }
  });

  it('should ignores an unknown column and falls back to the default order', async () => {
    const orderBys = await orderBysFor([{ orderBy: 'nope', order: 'ASC' }]);

    // The default ordering is category rank, then order, createdAt, id.
    expect(orderBys.length).toBeGreaterThan(1);
    expect(orderBys.some((entry) => entry.column.includes('nope'))).toBe(false);
  });

  it('should never lets an injected identifier through', async () => {
    const orderBys = await orderBysFor([
      { orderBy: 'title" DESC, (SELECT 1) --', order: 'ASC' },
    ]);

    expect(orderBys.some((entry) => entry.column.includes('SELECT'))).toBe(
      false,
    );
  });

  it('should accepts only ASC or DESC as the direction', async () => {
    const orderBys = await orderBysFor([
      { orderBy: 'title', order: 'DESC; DROP TABLE help_center' },
    ]);

    expect(orderBys).toEqual([
      { column: '"helpCenter"."title"', direction: 'ASC' },
    ]);
  });

  it('should lower-case desc still sorts descending', async () => {
    const orderBys = await orderBysFor([{ orderBy: 'title', order: 'desc' }]);

    expect(orderBys[0].direction).toBe('DESC');
  });
});
