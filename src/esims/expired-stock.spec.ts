import { EsimsRelationalRepository } from './infrastructure/persistence/relational/repositories/esim.repository';

/**
 * #021 — "khi khách mua sẽ không gửi những esim hết hạn nữa. Hiện tại đặt đơn
 * esim viettel thì hệ thống vẫn gửi esim hết hạn."
 *
 * FEFO made the bug as bad as it could be: an expired eSIM sorts FIRST by expiry,
 * so the one handed to the customer was the most expired one in stock. The SQL is
 * what these tests pin down.
 */
describe('Local stock excludes expired eSIMs (#021)', () => {
  function captureQuery() {
    const clauses: string[] = [];
    const qb: Record<string, unknown> = {
      where: jest.fn((sql: string) => {
        clauses.push(sql);
        return qb;
      }),
      andWhere: jest.fn((sql: string) => {
        clauses.push(sql);
        return qb;
      }),
      orderBy: jest.fn((...args: unknown[]) => {
        clauses.push(`ORDER BY ${args.join(' ')}`);
        return qb;
      }),
      addOrderBy: jest.fn((...args: unknown[]) => {
        clauses.push(`ORDER BY ${args.join(' ')}`);
        return qb;
      }),
      take: jest.fn(() => qb),
      getMany: jest.fn().mockResolvedValue([]),
    };

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
        await repository.findAvailableByPlanId(3, 2);
        return clauses.join(' | ');
      },
    };
  }

  it('should never offers an eSIM whose expiry has passed', async () => {
    const sql = await captureQuery().run();
    expect(sql).toContain('esim."expiresAt" >= now()');
  });

  it('should still offers stock that carries no expiry at all', async () => {
    // A null expiry means the import did not state one; it is not expired.
    const sql = await captureQuery().run();
    expect(sql).toContain('esim."expiresAt" IS NULL OR');
  });

  it('should keeps FEFO, so the stock closest to expiring is sold first', async () => {
    const sql = await captureQuery().run();
    expect(sql).toContain('ORDER BY esim."expiresAt" ASC NULLS LAST');
  });

  it('should still requires the eSIM to be unsold and unassigned', async () => {
    const sql = await captureQuery().run();
    expect(sql).toContain(`esim.status = 'available'`);
    expect(sql).toContain('esim."orderItemId" IS NULL');
    expect(sql).toContain('esim."userId" IS NULL');
  });
});
