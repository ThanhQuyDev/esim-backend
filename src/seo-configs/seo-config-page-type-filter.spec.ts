import { FindOperator } from 'typeorm';
import { SeoConfigsRelationalRepository } from './infrastructure/persistence/relational/repositories/seo-config.repository';

/**
 * SEO config list filtered by page type (#046).
 *
 * "Page type" is not a column: a config is a country page when it points at a
 * destination, a region page when it points at a region, and "other" when it
 * points at nothing (the hand-typed URLs like `/`, `/blog`). The filter has to
 * translate that into null / not-null checks, and it must survive being combined
 * with `search`, which turns the single WHERE into an array of OR branches — a
 * page-type clause dropped from one branch would silently leak rows of every
 * other type back into the list.
 */

type Where = Record<string, unknown>;

function makeRepository() {
  const calls: { where: Where | Where[] }[] = [];
  const findAndCount = jest.fn((options: { where: Where | Where[] }) => {
    calls.push({ where: options.where });
    return Promise.resolve([[], 0]);
  });

  const repo = new SeoConfigsRelationalRepository({
    findAndCount,
  } as never);

  return { repo, calls };
}

const PAGINATION = { page: 1, limit: 10 };

async function whereFor(
  filterOptions: Record<string, unknown>,
): Promise<Where | Where[]> {
  const { repo, calls } = makeRepository();
  await repo.findManyWithPagination({
    filterOptions: filterOptions as never,
    sortOptions: null,
    paginationOptions: PAGINATION,
  });
  return calls[0].where;
}

/** typeorm's IsNull() / Not(IsNull()) come back as FindOperator instances. */
function operatorType(value: unknown): string | undefined {
  return value instanceof FindOperator ? value.type : undefined;
}

function isNotNull(value: unknown): boolean {
  return (
    value instanceof FindOperator &&
    value.type === 'not' &&
    operatorType(value.child) === 'isNull'
  );
}

describe('SEO config list filtered by page type', () => {
  it('should keep only configs attached to a country', async () => {
    const where = (await whereFor({ pageType: 'destination' })) as Where;

    expect(isNotNull(where.destinationId)).toBe(true);
    // Never over-constrains: a country config may also carry a plan id.
    expect(where.regionId).toBeUndefined();
    expect(where.planId).toBeUndefined();
  });

  it('should keep only configs attached to a region', async () => {
    const where = (await whereFor({ pageType: 'region' })) as Where;

    expect(isNotNull(where.regionId)).toBe(true);
    expect(where.destinationId).toBeUndefined();
  });

  it('should keep only configs attached to a plan', async () => {
    const where = (await whereFor({ pageType: 'plan' })) as Where;

    expect(isNotNull(where.planId)).toBe(true);
  });

  it('should treat "other" as attached to nothing at all', async () => {
    const where = (await whereFor({ pageType: 'other' })) as Where;

    // All three must be null, or a country page would show up under "other".
    expect(operatorType(where.destinationId)).toBe('isNull');
    expect(operatorType(where.regionId)).toBe('isNull');
    expect(operatorType(where.planId)).toBe('isNull');
  });

  it('should not filter at all when no page type was chosen', async () => {
    const where = (await whereFor({})) as Where;

    expect(where.destinationId).toBeUndefined();
    expect(where.regionId).toBeUndefined();
    expect(where.planId).toBeUndefined();
  });

  it('should combine the page type with a URL search', async () => {
    const where = (await whereFor({
      pageType: 'region',
      search: 'chau-au',
    })) as Where;

    expect(Array.isArray(where)).toBe(false);
    expect(isNotNull(where.regionId)).toBe(true);
    expect(operatorType(where.url)).toBe('ilike');
    expect((where.url as FindOperator<string>).value).toBe('%chau-au%');
  });

  it('should search by page URL only, never by meta copy (#005)', async () => {
    // "destination" used to return "/en/home" because its meta description
    // contained the word.
    const where = (await whereFor({ search: ' destination ' })) as Where;

    expect((where.url as FindOperator<string>).value).toBe('%destination%');
    expect(where.metaTitle).toBeUndefined();
    expect(where.metaDescription).toBeUndefined();
  });

  it('should combine with the active filter rather than replacing it', async () => {
    const where = (await whereFor({
      pageType: 'destination',
      isActive: false,
    })) as Where;

    expect(where.isActive).toBe(false);
    expect(isNotNull(where.destinationId)).toBe(true);
  });

  it('should let an explicit id win over the page type', async () => {
    // Picking one country is more specific than "any country".
    const where = (await whereFor({
      pageType: 'destination',
      destinationId: 7,
    })) as Where;

    expect(where.destinationId).toBe(7);
  });
});
