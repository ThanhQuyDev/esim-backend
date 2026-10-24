import { PlansRelationalRepository } from './infrastructure/persistence/relational/repositories/plan.repository';

/**
 * CMS plan list (vande #019): several destinations/regions at once, the
 * three-value Top-Up column, the search box matching supplier codes and slugs,
 * and deleting ticked plans together.
 */
function makeRepository() {
  const where: { sql: string; params?: Record<string, unknown> }[] = [];
  const qb: Record<string, jest.Mock> = {};
  const chain =
    (fn?: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      fn?.(...args);
      return qb;
    };
  const record = (sql: unknown, params: unknown) =>
    where.push({
      sql: String(sql),
      params: params as Record<string, unknown> | undefined,
    });
  for (const m of [
    'leftJoinAndSelect',
    'leftJoin',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
  ]) {
    qb[m] = jest.fn(chain());
  }
  qb.where = jest.fn(chain(record));
  qb.andWhere = jest.fn(chain(record));
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getMany = jest.fn().mockResolvedValue([]);
  const softDelete = jest.fn().mockResolvedValue({ affected: 3 });

  const repo = new PlansRelationalRepository({
    createQueryBuilder: () => qb,
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    softDelete,
  } as never);
  return { repo, where, softDelete };
}

const PAGINATION = { page: 1, limit: 10 };

describe('CMS plan list filters (vande #019)', () => {
  it('should match any of several destinations and regions', async () => {
    const { repo, where } = makeRepository();
    await repo.findManyWithPagination({
      filterOptions: { locations: ['d:12', 'r:3', 'r:4', 'bad'] },
      sortOptions: null,
      paginationOptions: PAGINATION,
    });

    const clause = where.find((w) => w.sql.includes(':...locDestIds'));
    expect(clause?.sql).toBe(
      '(plan."destinationId" IN (:...locDestIds) OR plan."regionId" IN (:...locRegionIds))',
    );
    expect(clause?.params).toEqual({ locDestIds: [12], locRegionIds: [3, 4] });
  });

  it('should tell add-ons apart from top-ups in the Top-Up filter', async () => {
    const { repo, where } = makeRepository();
    await repo.findManyWithPagination({
      filterOptions: { topUpKind: ['addon', 'none'] },
      sortOptions: null,
      paginationOptions: PAGINATION,
    });

    const clause = where.find((w) => w.sql.includes('"isAddOn"'));
    expect(clause?.sql).toContain('COALESCE(plan."isAddOn", false) = true');
    expect(clause?.sql).toContain('COALESCE(plan."topUp", false) = false');
    expect(clause?.sql).toContain(' OR ');
  });

  it('should find a plan by its supplier code or slug from the search box', async () => {
    const { repo, where } = makeRepository();
    await repo.findManyWithPagination({
      filterOptions: { search: 'PVG1G9ZU2' },
      sortOptions: null,
      paginationOptions: PAGINATION,
    });

    const clause = where.find((w) => w.sql.includes(':search'));
    expect(clause?.sql).toContain('plan."providerPlanId" ILIKE :search');
    expect(clause?.sql).toContain('plan.slug ILIKE :search');
  });

  it('should soft-delete every ticked plan in one go', async () => {
    const { repo, softDelete } = makeRepository();
    await expect(repo.removeMany([1, 2, 3])).resolves.toBe(3);
    expect(softDelete).toHaveBeenCalledWith([1, 2, 3]);
  });
});
