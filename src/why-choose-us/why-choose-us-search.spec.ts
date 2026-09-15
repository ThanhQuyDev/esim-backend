import {
  WhyChooseUsRelationalRepository,
  typeSearchTerm,
} from './infrastructure/persistence/relational/repositories/why-choose-us.repository';

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

async function clausesFor(filterOptions: {
  search?: string;
  type?: string;
}): Promise<CapturedWhere[]> {
  const captured: CapturedWhere[] = [];
  const qb = fakeQueryBuilder(captured);
  const repo = new WhyChooseUsRelationalRepository({
    createQueryBuilder: () => qb,
  } as never);

  await repo.findAllWithPagination({
    filterOptions,
    sortOptions: null,
    paginationOptions: { page: 1, limit: 10 },
  });
  return captured;
}

describe('Why-choose-us search filter', () => {
  it('should let an admin narrow the list to one page by typing its name', async () => {
    const captured = await clausesFor({ search: 'trang chu' });

    const clause = captured.find((c) => c.sql.includes(':search'));
    expect(clause).toBeDefined();
    expect(clause?.params).toEqual({
      search: '%trang chu%',
      typeSearch: '%trang chu%',
    });

    // Title/description stay searchable…
    expect(clause!.sql).toContain('whyChooseUs.title');
    expect(clause!.sql).toContain('whyChooseUs.description');
    // …and the page type is now searchable too, with `_` normalised so
    // "trang chu" matches the stored "trang_chu".
    expect(clause!.sql).toContain(
      "REPLACE(whyChooseUs.type, '_', ' ') ILIKE :typeSearch",
    );
  });

  it('should find a page by its label as the CMS shows it, accents included (#005)', async () => {
    const [clause] = await clausesFor({ search: 'Quốc gia' });

    // Title/description keep the Vietnamese text as typed…
    expect(clause.params?.search).toBe('%Quốc gia%');
    // …while the type is matched without accents, like the stored "quoc_gia".
    expect(clause.params?.typeSearch).toBe('%quoc gia%');
  });

  it.each([
    ['Trang chủ', 'trang chu'],
    ['khu_vuc', 'khu vuc'],
    ['country', 'quoc gia'],
    ['Home', 'trang chu'],
  ])('should fold "%s" to the page type "%s"', (typed, folded) => {
    expect(typeSearchTerm(typed)).toBe(folded);
  });

  it('should keep a single page-type filter working', async () => {
    const captured = await clausesFor({ type: 'quoc_gia' });

    const clause = captured.find((c) => c.sql.includes(':typePattern0'));
    expect(clause?.params).toEqual({ typePattern0: '%,quoc_gia,%' });
  });

  it('should match rows of any of several page types at once (#005)', async () => {
    const captured = await clausesFor({ type: 'trang_chu, quoc_gia,khu_vuc' });

    const clause = captured.find((c) => c.sql.includes(':typePattern0'));
    expect(clause?.params).toEqual({
      typePattern0: '%,trang_chu,%',
      typePattern1: '%,quoc_gia,%',
      typePattern2: '%,khu_vuc,%',
    });
    // OR-ed inside one clause, so it still ANDs with search and language.
    expect(clause!.sql.match(/ OR /g)).toHaveLength(2);
    expect(clause!.sql.startsWith('(')).toBe(true);
  });
});
