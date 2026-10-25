import { PlansRelationalRepository } from './infrastructure/persistence/relational/repositories/plan.repository';
import { PlanMapper } from './infrastructure/persistence/relational/mappers/plan.mapper';

/**
 * The cost after the supplier's tax/fee is compared unrounded (vande #064).
 *
 * Rounded to the thousand, Spain 5GB/30 days cost 62.000đ at Airalo
 * (62.129đ) and at esimaccess (61.611đ): a tie, settled by the lower id —
 * the dearer one was shown on the site.
 */
function repo() {
  const query = jest.fn().mockResolvedValue([]);
  return {
    repo: new PlansRelationalRepository({ query } as never),
    sqls: () => (query.mock.calls as [string][]).map(([sql]) => sql),
  };
}

describe('cheapest plan on the unrounded cost (vande #064)', () => {
  it('should store the exact cost beside the rounded one when converting', async () => {
    const { repo: r, sqls } = repo();
    await r.updateAllVndPrices(25887.1);
    const [dollar, dong] = sqls();
    expect(dollar).toMatch(/"vndCostPrice" = ROUND\(.*\/ 1000\) \* 1000/);
    expect(dollar).toMatch(/"vndCostExact" = .*\* \$1::numeric,/);
    expect(dollar).not.toMatch(/"vndCostExact" = ROUND/);
    expect(dong).toMatch(/"vndCostExact" = \(/);
    expect(dong).not.toMatch(/"vndCostExact" = ROUND/);
  });

  it('should rank on the exact cost first, then the rounded one', async () => {
    const { repo: r, sqls } = repo();
    await r.markCheapestPlans();
    const rank = sqls()[1];
    expect(rank.indexOf('"vndCostExact"')).toBeGreaterThan(-1);
    expect(rank.indexOf('"vndCostExact" > 0')).toBeLessThan(
      rank.indexOf('"vndCostPrice" > 0'),
    );
  });

  it('should not let an ordinary save wipe the exact cost', () => {
    const plan = PlanMapper.toDomain({ id: 1, vndCostPrice: 62000 } as never);
    delete (plan as { vndCostExact?: unknown }).vndCostExact;
    const row = PlanMapper.toPersistence(plan);
    expect('vndCostExact' in row).toBe(false);
  });
});
