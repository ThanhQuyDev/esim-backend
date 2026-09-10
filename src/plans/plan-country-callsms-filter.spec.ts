import { PlansRelationalRepository } from './infrastructure/persistence/relational/repositories/plan.repository';

/**
 * CMS plan list filters (#035): by country/region, and by whether the plan has
 * calls/SMS.
 *
 * These only work because the query joins five tables (destination, its child
 * destinations, region, and the region's member destinations) and because
 * asking for either filter switches the repository off its plain `findAndCount`
 * path onto the query builder. Both are easy to break by accident, and when
 * they break the filter silently returns everything instead of erroring — so
 * they are pinned here.
 */

interface CapturedWhere {
  sql: string;
  params?: Record<string, unknown>;
}

function fakeQueryBuilder(captured: CapturedWhere[], joins: string[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain =
    (fn?: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      fn?.(...args);
      return qb;
    };

  const recordJoin = (target: unknown, alias: unknown) =>
    joins.push(`${String(target)} as ${String(alias)}`);

  qb.leftJoinAndSelect = jest.fn(chain(recordJoin));
  qb.leftJoin = jest.fn(chain(recordJoin));
  qb.innerJoin = jest.fn(chain(recordJoin));
  qb.select = jest.fn(chain());
  qb.addSelect = jest.fn(chain());
  qb.orderBy = jest.fn(chain());
  qb.addOrderBy = jest.fn(chain());
  qb.skip = jest.fn(chain());
  qb.take = jest.fn(chain());
  qb.andWhere = jest.fn(
    chain((sql, params) =>
      captured.push({
        sql: String(sql),
        params: params as Record<string, unknown> | undefined,
      }),
    ),
  );
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  return qb;
}

function makeRepository() {
  const captured: CapturedWhere[] = [];
  const joins: string[] = [];
  const findAndCount = jest.fn().mockResolvedValue([[], 0]);

  const repo = new PlansRelationalRepository({
    createQueryBuilder: () => fakeQueryBuilder(captured, joins),
    findAndCount,
  } as never);

  return { repo, captured, joins, findAndCount };
}

const PAGINATION = { page: 1, limit: 10 };

describe('Plan list filtered by country / region', () => {
  it('should match the country code, the destination and the region name', async () => {
    const { repo, captured } = makeRepository();

    await repo.findManyWithPagination({
      filterOptions: { country: 'Nhật' },
      sortOptions: null,
      paginationOptions: PAGINATION,
    });

    const clause = captured.find((c) => c.sql.includes(':country'));
    expect(clause).toBeDefined();
    expect(clause?.params).toEqual({ country: '%Nhật%' });
    expect(clause!.sql).toContain('plan."countryCode"');
    expect(clause!.sql).toContain('dest.name');
    expect(clause!.sql).toContain('region.name');
  });

  it('should find a region by one of its member countries', async () => {
    const { repo, captured, joins } = makeRepository();

    await repo.findManyWithPagination({
      filterOptions: { country: 'Nhật' },
      sortOptions: null,
      paginationOptions: PAGINATION,
    });

    const clause = captured.find((c) => c.sql.includes(':country'))!;
    // Typing a country must also surface the regional packs that include it,
    // which is what `regionDest` is joined for.
    expect(clause.sql).toContain('regionDest.name');
    expect(joins.join(' ')).toContain('region.destinations');
  });

  it('should switch to the joined query, not the plain finder', async () => {
    const { repo, findAndCount } = makeRepository();

    await repo.findManyWithPagination({
      filterOptions: { country: 'Nhật' },
      sortOptions: null,
      paginationOptions: PAGINATION,
    });

    // The plain `findAndCount` path cannot see the joined tables, so asking
    // for a country filter must never fall through to it.
    expect(findAndCount).not.toHaveBeenCalled();
  });
});

describe('Plan list filtered by calls / SMS', () => {
  it('should keep only plans that have calls or SMS', async () => {
    const { repo, captured } = makeRepository();

    await repo.findManyWithPagination({
      filterOptions: { hasCallSms: true },
      sortOptions: null,
      paginationOptions: PAGINATION,
    });

    const clause = captured.find((c) => c.sql.includes('plan.sms'));
    expect(clause).toBeDefined();
    expect(clause!.sql).toContain('> 0');
    // COALESCE, because a NULL means "none" and would otherwise drop the row.
    expect(clause!.sql).toContain('COALESCE');
  });

  it('should keep only plans that have neither, when asked for "Không"', async () => {
    const { repo, captured } = makeRepository();

    await repo.findManyWithPagination({
      filterOptions: { hasCallSms: false },
      sortOptions: null,
      paginationOptions: PAGINATION,
    });

    const clause = captured.find((c) => c.sql.includes('plan.sms'))!;
    expect(clause.sql).toContain('<= 0');
    expect(clause.sql).toContain('AND');
  });

  it('should not filter at all when the question was not asked', async () => {
    const { repo, captured, findAndCount } = makeRepository();

    await repo.findManyWithPagination({
      filterOptions: {},
      sortOptions: null,
      paginationOptions: PAGINATION,
    });

    expect(captured.some((c) => c.sql.includes('plan.sms'))).toBe(false);
    // With no joined filter requested, the cheap path is used.
    expect(findAndCount).toHaveBeenCalled();
  });
});
