import { DestinationsRelationalRepository } from './infrastructure/persistence/relational/repositories/destination.repository';
import { RegionsRelationalRepository } from '../regions/infrastructure/persistence/relational/repositories/region.repository';

/**
 * Storefront search has to match what the customer can actually SEE on the
 * card — the localized `title` / `titleVi` — not just the internal `name`,
 * which still holds the provider's English wording for many records.
 *
 * These tests capture the WHERE fragments handed to the query builder, so a
 * future edit that quietly drops the title columns (or re-adds slug matching,
 * which would make "esim" match the whole catalogue) fails here.
 */

interface CapturedWhere {
  sql: string;
  params?: Record<string, unknown>;
}

/** Minimal chainable query-builder stub that records every andWhere(). */
function fakeQueryBuilder(captured: CapturedWhere[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain =
    (fn?: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      fn?.(...args);
      return qb;
    };

  qb.addSelect = jest.fn(chain());
  qb.leftJoin = jest.fn(chain());
  qb.groupBy = jest.fn(chain());
  qb.orderBy = jest.fn(chain());
  qb.addOrderBy = jest.fn(chain());
  qb.skip = jest.fn(chain());
  qb.take = jest.fn(chain());
  qb.offset = jest.fn(chain());
  qb.limit = jest.fn(chain());
  qb.andWhere = jest.fn(
    chain((sql, params) =>
      captured.push({
        sql: String(sql),
        params: params as Record<string, unknown> | undefined,
      }),
    ),
  );
  qb.clone = jest.fn(() => qb);
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getRawAndEntities = jest.fn().mockResolvedValue({ entities: [], raw: [] });
  return qb;
}

/** The single WHERE fragment that carries the `:search` parameter. */
function searchClause(captured: CapturedWhere[]): string {
  const clause = captured.find((c) => c.sql.includes(':search'));
  expect(clause).toBeDefined();
  expect(clause?.params).toEqual({ search: '%chau a%' });
  return clause!.sql;
}

describe('Destination search filter', () => {
  it('should match the localized titles as well as name/keySearch/countryCode', async () => {
    const captured: CapturedWhere[] = [];
    const qb = fakeQueryBuilder(captured);
    const repo = new DestinationsRelationalRepository({
      createQueryBuilder: () => qb,
    } as never);

    await repo.findManyWithPagination({
      filterOptions: { search: 'chau a' },
      sortOptions: null,
      paginationOptions: { page: 1, limit: 20 },
    });

    const sql = searchClause(captured);
    expect(sql).toContain('destination.name');
    expect(sql).toContain('destination.title');
    expect(sql).toContain('destination.titleVi');
    expect(sql).toContain('destination.keySearch');
    expect(sql).toContain('destination.countryCode');
  });

  it('should not match on slug, so "esim" cannot return the whole catalogue', async () => {
    const captured: CapturedWhere[] = [];
    const qb = fakeQueryBuilder(captured);
    const repo = new DestinationsRelationalRepository({
      createQueryBuilder: () => qb,
    } as never);

    await repo.findManyWithPagination({
      filterOptions: { search: 'chau a' },
      sortOptions: null,
      paginationOptions: { page: 1, limit: 20 },
    });

    expect(searchClause(captured)).not.toContain('slug');
  });
});

describe('Region search filter', () => {
  it('should match region titles and member-destination titles', async () => {
    const captured: CapturedWhere[] = [];
    const qb = fakeQueryBuilder(captured);
    const repo = new RegionsRelationalRepository(
      { createQueryBuilder: () => qb } as never,
      {} as never,
    );

    await repo.findManyWithPagination({
      filterOptions: { search: 'chau a' },
      sortOptions: null,
      paginationOptions: { page: 1, limit: 20 },
    });

    const sql = searchClause(captured);
    expect(sql).toContain('region.name');
    expect(sql).toContain('region.title');
    // `dest` is a raw table join, so its camelCase columns must stay quoted.
    expect(sql).toContain('region."titleVi"');
    expect(sql).toContain('dest.name');
    expect(sql).toContain('dest.title');
    expect(sql).toContain('dest."titleVi"');
    expect(sql).not.toContain('slug');
  });
});
