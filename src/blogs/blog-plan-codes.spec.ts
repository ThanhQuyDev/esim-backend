import { BlogRelationalRepository } from './infrastructure/persistence/relational/repositories/blog.repository';

/**
 * #047 — related plans are linked by a provider-sourced code, not by numeric plan
 * id.
 *
 * The bug being fixed: `blog_plans` is keyed by plan id, and a full catalogue
 * re-import deletes and recreates plan rows, so every older article silently lost
 * its related plans with no record of which ones they were. A plan slug or a
 * supplier package code comes back unchanged, so the link survives.
 *
 * The risk introduced: `plan.slug` is unique but `providerPlanId` has no unique
 * index, so a code can name more than one plan. These tests pin the tie-break.
 */
describe('Blog related plans by code (#047)', () => {
  type PlanRow = {
    id: number;
    slug: string;
    providerPlanId: string;
    name: string;
    isActive: boolean;
  };

  function plan(over: Partial<PlanRow> = {}): PlanRow {
    return {
      id: 1,
      slug: 'jp-5gb-30days',
      providerPlanId: 'JC056',
      name: 'Japan 5GB',
      isActive: true,
      ...over,
    };
  }

  /** Captures the plan query and returns canned rows. */
  function makeRepo(planRows: PlanRow[]) {
    const captured: { sql: string; params?: Record<string, unknown> }[] = [];
    const planQb: Record<string, jest.Mock> = {};
    const chain =
      (fn?: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        fn?.(...args);
        return planQb;
      };
    planQb.where = jest.fn(
      chain((sql, params) =>
        captured.push({
          sql: String(sql),
          params: params as Record<string, unknown>,
        }),
      ),
    );
    planQb.orWhere = jest.fn(
      chain((sql, params) =>
        captured.push({
          sql: String(sql),
          params: params as Record<string, unknown>,
        }),
      ),
    );
    planQb.getMany = jest.fn().mockResolvedValue(planRows);

    const repo = new BlogRelationalRepository(
      {} as never,
      {} as never,
      { createQueryBuilder: () => planQb } as never,
      {} as never,
      {} as never,
    );

    return { repo, captured, planQb };
  }

  /** `resolvePlansFromCodes` is private; it is the unit under test. */
  function resolve(
    repo: BlogRelationalRepository,
    blogs: Record<string, unknown>[],
  ) {
    return (
      repo as unknown as {
        resolvePlansFromCodes: (b: unknown[]) => Promise<void>;
      }
    ).resolvePlansFromCodes(blogs);
  }

  it('should resolves a plan by its slug', async () => {
    const { repo } = makeRepo([plan({ id: 7, slug: 'jp-5gb-30days' })]);
    const blog = { planCodes: ['jp-5gb-30days'] } as Record<string, unknown>;

    await resolve(repo, [blog]);

    expect(blog.planIds).toEqual([7]);
  });

  it('should resolves a plan by the supplier package code', async () => {
    const { repo } = makeRepo([plan({ id: 7, providerPlanId: 'JC056' })]);
    const blog = { planCodes: ['JC056'] } as Record<string, unknown>;

    await resolve(repo, [blog]);

    expect(blog.planIds).toEqual([7]);
  });

  it('should keeps the order the editor typed', async () => {
    const { repo } = makeRepo([
      plan({ id: 1, slug: 'a', providerPlanId: 'A' }),
      plan({ id: 2, slug: 'b', providerPlanId: 'B' }),
      plan({ id: 3, slug: 'c', providerPlanId: 'C' }),
    ]);
    const blog = { planCodes: ['c', 'a', 'b'] } as Record<string, unknown>;

    await resolve(repo, [blog]);

    expect(blog.planIds).toEqual([3, 1, 2]);
  });

  it('should prefers an active plan when a package code is ambiguous', async () => {
    // `providerPlanId` has no unique index, so two suppliers can share a code.
    // The active one is the one an editor means.
    const { repo } = makeRepo([
      plan({ id: 5, slug: 'old', providerPlanId: 'JC056', isActive: false }),
      plan({ id: 9, slug: 'new', providerPlanId: 'JC056', isActive: true }),
    ]);
    const blog = { planCodes: ['JC056'] } as Record<string, unknown>;

    await resolve(repo, [blog]);

    expect(blog.planIds).toEqual([9]);
  });

  it('should breaks a remaining tie by lowest id, so the page does not shuffle', async () => {
    const { repo } = makeRepo([
      plan({ id: 9, slug: 'nine', providerPlanId: 'JC056' }),
      plan({ id: 4, slug: 'four', providerPlanId: 'JC056' }),
    ]);
    const blog = { planCodes: ['JC056'] } as Record<string, unknown>;

    await resolve(repo, [blog]);

    expect(blog.planIds).toEqual([4]);
  });

  it('should drops a code that resolves to nothing rather than rendering a gap', async () => {
    const { repo } = makeRepo([
      plan({ id: 1, slug: 'a', providerPlanId: 'A' }),
    ]);
    const blog = { planCodes: ['a', 'gone'] } as Record<string, unknown>;

    await resolve(repo, [blog]);

    expect(blog.planIds).toEqual([1]);
  });

  it('should leaves an article with no codes on its join-table plans', async () => {
    // Articles saved before this existed still work; nothing is emptied.
    const { repo, planQb } = makeRepo([]);
    const blog = { planIds: [11, 12] } as Record<string, unknown>;

    await resolve(repo, [blog]);

    expect(blog.planIds).toEqual([11, 12]);
    expect(planQb.getMany).not.toHaveBeenCalled();
  });

  it('should asks for every article’s codes in one query', async () => {
    const { repo, captured, planQb } = makeRepo([
      plan({ id: 1, slug: 'a', providerPlanId: 'A' }),
      plan({ id: 2, slug: 'b', providerPlanId: 'B' }),
    ]);

    await resolve(repo, [{ planCodes: ['a'] }, { planCodes: ['b'] }]);

    expect(planQb.getMany).toHaveBeenCalledTimes(1);
    // Matched against both columns, because either kind of code is accepted.
    expect(captured[0].sql).toContain('plan.slug IN');
    expect(captured[1].sql).toContain('providerPlanId" IN');
    expect(captured[0].params?.codes).toEqual(['a', 'b']);
  });

  it('should matches each article to its own plans', async () => {
    const { repo } = makeRepo([
      plan({ id: 1, slug: 'a', providerPlanId: 'A' }),
      plan({ id: 2, slug: 'b', providerPlanId: 'B' }),
    ]);
    const first = { planCodes: ['a'] } as Record<string, unknown>;
    const second = { planCodes: ['b'] } as Record<string, unknown>;

    await resolve(repo, [first, second]);

    expect(first.planIds).toEqual([1]);
    expect(second.planIds).toEqual([2]);
  });
});
