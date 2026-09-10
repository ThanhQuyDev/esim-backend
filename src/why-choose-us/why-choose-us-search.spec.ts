import { WhyChooseUsRelationalRepository } from './infrastructure/persistence/relational/repositories/why-choose-us.repository';

/**
 * The CMS lists FAQ / SEO / "Tại sao chọn chúng tôi" rows for every page at
 * once, so an admin editing one page has to be able to narrow the list to that
 * page. FAQ and SEO rows carry a `url` and are searched by it; a
 * "Tại sao chọn chúng tôi" row instead carries a page `type`
 * (`trang_chu` / `quoc_gia` / `khu_vuc`), which the search clause must cover.
 */

interface CapturedWhere {
  sql: string;
  params?: Record<string, unknown>;
}

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
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  qb.getRawAndEntities = jest.fn().mockResolvedValue({ entities: [], raw: [] });
  return qb;
}

describe('Why-choose-us search filter', () => {
  it('should let an admin narrow the list to one page by typing its name', async () => {
    const captured: CapturedWhere[] = [];
    const qb = fakeQueryBuilder(captured);
    const repo = new WhyChooseUsRelationalRepository({
      createQueryBuilder: () => qb,
    } as never);

    await repo.findAllWithPagination({
      filterOptions: { search: 'trang chu' },
      sortOptions: null,
      paginationOptions: { page: 1, limit: 10 },
    });

    const clause = captured.find((c) => c.sql.includes(':search'));
    expect(clause).toBeDefined();
    expect(clause?.params).toEqual({ search: '%trang chu%' });

    // Title/description stay searchable…
    expect(clause!.sql).toContain('whyChooseUs.title');
    expect(clause!.sql).toContain('whyChooseUs.description');
    // …and the page type is now searchable too, with `_` normalised so
    // "trang chu" matches the stored "trang_chu".
    expect(clause!.sql).toContain("REPLACE(whyChooseUs.type, '_', ' ')");
  });
});
