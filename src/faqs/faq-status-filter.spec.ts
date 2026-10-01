import { FaqRelationalRepository } from './infrastructure/persistence/relational/repositories/faq.repository';

/**
 * #050 — the CMS list gained a Trạng thái filter.
 *
 * The trap: the existing question/answer/url search is expressed as an ARRAY of
 * where-clauses, which TypeORM ORs. A status filter added as a sibling key would
 * have applied to only one of those three branches, so searching a word while
 * filtering "không hoạt động" would still return active rows that matched on
 * `answer` or `url`.
 */
describe('FAQ status filter (#050)', () => {
  function makeRepo() {
    const findAndCount = jest.fn().mockResolvedValue([[], 0]);
    const repo = new FaqRelationalRepository(
      { findAndCount } as never,
      {} as never,
    );
    return { repo, findAndCount };
  }

  async function whereFor(filterOptions: Record<string, unknown>) {
    const { repo, findAndCount } = makeRepo();
    await repo.findAllWithPagination({
      filterOptions: filterOptions as never,
      paginationOptions: { page: 1, limit: 10 },
    });
    return findAndCount.mock.calls[0][0].where;
  }

  it('should filters on the flag when Hoạt động is picked', async () => {
    expect(await whereFor({ isActive: true })).toEqual({ isActive: true });
  });

  it('should treats Không hoạt động as a real choice, not as "all"', async () => {
    expect(await whereFor({ isActive: false })).toEqual({ isActive: false });
  });

  it('should adds nothing when no status is picked', async () => {
    expect(await whereFor({})).toEqual({});
  });

  it('should applies the status to every branch of the search OR', async () => {
    const where = await whereFor({ search: 'esim', isActive: false });

    expect(Array.isArray(where)).toBe(true);
    expect(where).toHaveLength(3);
    for (const branch of where as Record<string, unknown>[]) {
      expect(branch.isActive).toBe(false);
    }
    // …and each branch still searches its own column.
    const columns = (where as Record<string, unknown>[]).map((branch) =>
      Object.keys(branch).find((key) => key !== 'isActive'),
    );
    expect(columns).toEqual(['question', 'answer', 'url']);
  });

  it('should leaves the search alone when no status is picked', async () => {
    const where = await whereFor({ search: 'esim' });

    expect(where).toHaveLength(3);
    for (const branch of where as Record<string, unknown>[]) {
      expect(branch.isActive).toBeUndefined();
    }
  });
});
