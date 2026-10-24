import { EsimsRelationalRepository } from './infrastructure/persistence/relational/repositories/esim.repository';

/**
 * vande #021 — one search box on the CMS eSIM list: order number, buyer email,
 * ICCID or plan name.
 */
describe('eSIM list single search box (vande #021)', () => {
  it('should match order number, email, ICCID and plan name together', async () => {
    const where: { sql: string; params?: Record<string, unknown> }[] = [];
    const qb: Record<string, jest.Mock> = {};
    const chain =
      (fn?: (...a: unknown[]) => void) =>
      (...a: unknown[]) => {
        fn?.(...a);
        return qb;
      };
    for (const m of [
      'leftJoinAndSelect',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ])
      qb[m] = jest.fn(chain());
    qb.andWhere = jest.fn(
      chain((sql, params) =>
        where.push({
          sql: String(sql),
          params: params as Record<string, unknown>,
        }),
      ),
    );
    qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
    const repo = new EsimsRelationalRepository({
      createQueryBuilder: () => qb,
    } as never);

    await repo.findManyWithPagination({
      filterOptions: { q: ' ESIM-2026 ', includeAll: true } as never,
      sortOptions: null,
      paginationOptions: { page: 1, limit: 10 },
    });

    const clause = where.find((w) => w.sql.includes(':q'));
    expect(clause?.params).toEqual({ q: '%ESIM-2026%' });
    for (const part of [
      'esim.iccid ILIKE :q',
      'plan.name ILIKE :q',
      'qo."orderNumber" ILIKE :q',
      'u.email ILIKE :q',
    ]) {
      expect(clause?.sql).toContain(part);
    }
  });
});
