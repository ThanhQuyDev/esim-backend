import { EsimsRelationalRepository } from './infrastructure/persistence/relational/repositories/esim.repository';

/**
 * The CMS eSIM list has a "Tên gói" filter so an admin can pull up every eSIM
 * belonging to one package. It only works because the query joins the plan and
 * matches on `plan.name`; these tests pin that, including the two things easy
 * to break — dropping the filter from the EXPORT query (so the downloaded file
 * would not match what is on screen), and losing the plan join it depends on.
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

  qb.leftJoinAndSelect = jest.fn(
    chain((relation) => joins.push(String(relation))),
  );
  qb.leftJoin = jest.fn(chain((relation) => joins.push(String(relation))));
  qb.innerJoin = jest.fn(chain((relation) => joins.push(String(relation))));
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
  qb.getMany = jest.fn().mockResolvedValue([]);
  return qb;
}

function makeRepository(captured: CapturedWhere[], joins: string[]) {
  const qb = fakeQueryBuilder(captured, joins);
  return new EsimsRelationalRepository({
    createQueryBuilder: () => qb,
  } as never);
}

describe('eSIM list filtered by plan name', () => {
  it('should match the plan name so one package can be pulled up on its own', async () => {
    const captured: CapturedWhere[] = [];
    const joins: string[] = [];
    const repo = makeRepository(captured, joins);

    await repo.findManyWithPagination({
      filterOptions: { planName: 'Nhật Bản 5GB' },
      sortOptions: null,
      paginationOptions: { page: 1, limit: 10 },
    });

    const clause = captured.find((c) => c.sql.includes(':planName'));
    expect(clause).toBeDefined();
    expect(clause?.sql).toContain('plan.name ILIKE');
    // Partial match: typing part of the name is enough.
    expect(clause?.params).toEqual({ planName: '%Nhật Bản 5GB%' });

    // The clause is useless without the plan join.
    expect(joins).toContain('esim.plan');
  });

  it('should leave the list unfiltered when no plan name is given', async () => {
    const captured: CapturedWhere[] = [];
    const repo = makeRepository(captured, []);

    await repo.findManyWithPagination({
      filterOptions: {},
      sortOptions: null,
      paginationOptions: { page: 1, limit: 10 },
    });

    expect(captured.some((c) => c.sql.includes(':planName'))).toBe(false);
  });

  it('should apply the same filter to the Excel export', async () => {
    const captured: CapturedWhere[] = [];
    const joins: string[] = [];
    const repo = makeRepository(captured, joins);

    await repo.findAllForExport({ planName: 'Wintel' } as never);

    const clause = captured.find((c) => c.sql.includes(':planName'));
    expect(clause).toBeDefined();
    expect(clause?.params).toEqual({ planName: '%Wintel%' });
    expect(joins).toContain('esim.plan');
  });
});
