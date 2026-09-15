import { PlansRelationalRepository } from './plan.repository';

/**
 * #053 — "Lưu lượt bán vào data để sau này show ra ngoài front end".
 */
describe('PlansRelationalRepository.recalculateSoldCounts', () => {
  function setup() {
    const manager = { query: jest.fn().mockResolvedValue(undefined) };
    const typeorm = {
      manager: {
        transaction: jest.fn(
          async (work: (m: typeof manager) => Promise<void>) => work(manager),
        ),
      },
    };
    const repository = new PlansRelationalRepository(typeorm as never);
    return { manager, typeorm, repository };
  }

  const sql = (call: unknown[]) => String(call[0]).replace(/\s+/g, ' ');

  it('should recount plans, then destinations and regions, in one transaction', async () => {
    const { manager, typeorm, repository } = setup();

    await repository.recalculateSoldCounts();

    expect(typeorm.manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledTimes(3);
    expect(sql(manager.query.mock.calls[0])).toContain('UPDATE "plan" p');
    expect(sql(manager.query.mock.calls[1])).toContain(
      'UPDATE "destination" t',
    );
    expect(sql(manager.query.mock.calls[1])).toContain(
      'p."destinationId" = t2."id"',
    );
    expect(sql(manager.query.mock.calls[2])).toContain('UPDATE "region" t');
    expect(sql(manager.query.mock.calls[2])).toContain(
      'p."regionId" = t2."id"',
    );
  });

  it('should count only completed items of paid orders', async () => {
    const { manager, repository } = setup();

    await repository.recalculateSoldCounts();

    const [statement, params] = manager.query.mock.calls[0];
    expect(String(statement)).toContain('oi."status" = ANY($1)');
    expect(String(statement)).toContain('o."status" = ANY($2)');
    expect(String(statement)).toContain('o."deletedAt" IS NULL');
    expect(params).toEqual([['completed'], ['paid']]);
  });

  it('should only write rows whose count changed', async () => {
    const { manager, repository } = setup();

    await repository.recalculateSoldCounts();

    for (const call of manager.query.mock.calls) {
      expect(sql(call)).toMatch(/"soldCount" <> /);
    }
  });
});
