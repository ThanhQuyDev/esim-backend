import { SeoConfigsRelationalRepository } from './infrastructure/persistence/relational/repositories/seo-config.repository';

/**
 * vande #084: the SEO list has one search box. It finds a config by its URL
 * or by the words of its Meta Title / Description, and keeps every other
 * filter on each branch of that OR.
 */
type Where = Record<string, unknown>;

async function whereFor(
  filterOptions: Record<string, unknown>,
): Promise<Where | Where[]> {
  const calls: (Where | Where[])[] = [];
  const repo = new SeoConfigsRelationalRepository({
    findAndCount: jest.fn((options: { where: Where | Where[] }) => {
      calls.push(options.where);
      return Promise.resolve([[], 0]);
    }),
  } as never);
  await repo.findManyWithPagination({
    filterOptions: filterOptions as never,
    sortOptions: null,
    paginationOptions: { page: 1, limit: 10 },
  });
  return calls[0];
}

const pattern = (value: unknown) =>
  (value as { _value?: unknown } | undefined)?._value;

describe('SEO list — one search box (vande #084)', () => {
  it('should look in the URL, the Meta Title and the Meta Description', async () => {
    const where = (await whereFor({ q: 'nhật bản' })) as Where[];

    expect(where).toHaveLength(3);
    expect(pattern(where[0].url)).toBe('%nhật bản%');
    expect(pattern(where[1].metaTitle)).toBe('%nhật bản%');
    expect(pattern(where[2].metaDescription)).toBe('%nhật bản%');
  });

  it('should keep the status filter on every branch', async () => {
    const where = (await whereFor({ q: 'japan', isActive: true })) as Where[];

    for (const branch of where) expect(branch.isActive).toBe(true);
  });

  it('should leave the old URL-only search as it was', async () => {
    const where = (await whereFor({ search: '/home' })) as Where;

    expect(Array.isArray(where)).toBe(false);
    expect(pattern(where.url)).toBe('%/home%');
    expect(where.metaTitle).toBeUndefined();
  });
});
