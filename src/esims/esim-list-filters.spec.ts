import { EsimsRelationalRepository } from './infrastructure/persistence/relational/repositories/esim.repository';
import { FilterEsimDto } from './dto/query-esim.dto';

/**
 * #020 — the eSIM list filters: plan type, status, supplier, Call/SMS, Topup and
 * the created / expiry date ranges.
 *
 * The SQL is asserted rather than rows: a `<=` on a bare `to` date silently drops
 * everything dated that day, and the supplier lives on two different columns
 * depending on where the eSIM came from. Both are easy to get quietly wrong.
 */
describe('eSIM list filters (#020)', () => {
  function capture(filters: Partial<FilterEsimDto>) {
    const clauses: { sql: string; params?: Record<string, unknown> }[] = [];
    const qb: Record<string, unknown> = {
      leftJoinAndSelect: jest.fn(() => qb),
      andWhere: jest.fn((sql: string, params?: Record<string, unknown>) => {
        clauses.push({ sql, params });
        return qb;
      }),
      addOrderBy: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    qb.createQueryBuilder = jest.fn(() => qb);

    const repository = Object.create(
      EsimsRelationalRepository.prototype,
    ) as EsimsRelationalRepository;
    (
      repository as unknown as {
        esimsRepository: { createQueryBuilder: unknown };
      }
    ).esimsRepository = { createQueryBuilder: () => qb };

    return {
      run: async () => {
        await repository.findManyWithPagination({
          filterOptions: filters as FilterEsimDto,
          paginationOptions: { page: 1, limit: 10 },
        });
        return { clauses, sql: clauses.map((c) => c.sql).join(' | ') };
      },
    };
  }

  it('should filters by plan type', async () => {
    const { sql } = await capture({
      includeAll: true,
      planType: ['daily', 'unlimited'],
    }).run();
    expect(sql).toContain('plan.type IN (:...planTypes)');
  });

  it('should matches the supplier on the eSIM OR on its plan', async () => {
    // API providers set it on the eSIM row; local inventory only on the plan, so
    // matching one column alone would miss half the rows.
    const { sql } = await capture({
      includeAll: true,
      provider: ['billion'],
    }).run();
    expect(sql).toContain('COALESCE(esim.provider, plan.provider)');
  });

  it('should filters eSIMs whose plan includes minutes or SMS', async () => {
    const { sql } = await capture({ includeAll: true, hasCallSms: true }).run();
    expect(sql).toContain('COALESCE(plan.sms, 0) > 0');
    expect(sql).toContain('COALESCE(plan.call, 0) > 0');
  });

  it('should filters data-only eSIMs, which is not the same as "no filter"', async () => {
    const { sql } = await capture({
      includeAll: true,
      hasCallSms: false,
    }).run();
    expect(sql).toContain('COALESCE(plan.sms, 0) <= 0');
    expect(sql).toContain('COALESCE(plan.call, 0) <= 0');
  });

  it('should filters by topup, treating a null column as false', async () => {
    const { sql } = await capture({ includeAll: true, topUp: true }).run();
    expect(sql).toContain('COALESCE(plan."topUp", false) = :topUp');
  });

  it('should created range: from is inclusive, to covers the whole day', async () => {
    const { clauses } = await capture({
      includeAll: true,
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
    }).run();

    const from = clauses.find((c) => c.sql.includes('createdFrom'));
    const to = clauses.find((c) => c.sql.includes('createdTo'));
    expect(from?.sql).toContain('>=');
    expect(to?.sql).toContain(`INTERVAL '1 day'`);
    expect(to?.sql).not.toMatch(/<=\s*:createdTo/);
  });

  it('should expiry range: same rule as the created range', async () => {
    const { clauses } = await capture({
      includeAll: true,
      expiresFrom: '2026-10-01',
      expiresTo: '2026-10-31',
    }).run();

    const from = clauses.find((c) => c.sql.includes('expiresFrom'));
    const to = clauses.find((c) => c.sql.includes('expiresTo'));
    expect(from?.sql).toContain('esim."expiresAt" >=');
    expect(to?.sql).toContain(`INTERVAL '1 day'`);
    expect(to?.sql).not.toMatch(/<=\s*:expiresTo/);
  });

  it('should hides refunded eSIMs only when no status and no includeAll was asked for', async () => {
    const withoutFlag = await capture({}).run();
    expect(withoutFlag.sql).toContain('esim.status != :refundedStatus');

    const withFlag = await capture({ includeAll: true }).run();
    expect(withFlag.sql).not.toContain('refundedStatus');
  });

  it('should applies no plan conditions when nothing is asked for', async () => {
    const { sql } = await capture({ includeAll: true }).run();
    expect(sql).not.toContain('plan.type');
    expect(sql).not.toContain('plan."topUp"');
    expect(sql).not.toContain('COALESCE(esim.provider');
  });
});
