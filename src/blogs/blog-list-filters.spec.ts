import { BlogRelationalRepository } from './infrastructure/persistence/relational/repositories/blog.repository';

/**
 * #046 — the article list filters: author select box, Xuất bản Có/không and
 * Nổi bật Có/không.
 *
 * The author options are the interesting part. They are derived from the
 * articles, not from the user table, so the select can never offer an author with
 * nothing to show; and an article written before author profiles existed carries
 * only a byline, so its slug has to be derived from the name — the same way the
 * filter itself resolves a slug.
 */

interface CapturedWhere {
  sql: string;
  params?: Record<string, unknown>;
}

function fakeQueryBuilder(captured: CapturedWhere[], rawRows: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {};
  const chain =
    (fn?: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      fn?.(...args);
      return qb;
    };

  qb.select = jest.fn(chain());
  qb.addSelect = jest.fn(chain());
  qb.leftJoin = jest.fn(chain());
  qb.leftJoinAndSelect = jest.fn(chain());
  qb.where = jest.fn(chain());
  qb.groupBy = jest.fn(chain());
  qb.addGroupBy = jest.fn(chain());
  qb.orderBy = jest.fn(chain());
  qb.addOrderBy = jest.fn(chain());
  qb.skip = jest.fn(chain());
  qb.take = jest.fn(chain());
  qb.andWhere = jest.fn(
    chain((sql, params) =>
      captured.push({
        sql: String(sql),
        params: params as Record<string, unknown> | undefined,
      }),
    ),
  );
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  qb.getRawMany = jest.fn().mockResolvedValue(rawRows);
  return qb;
}

function makeRepo(qb: Record<string, jest.Mock>) {
  return new BlogRelationalRepository(
    { createQueryBuilder: () => qb } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('Blog list filters (#046)', () => {
  describe('Nổi bật', () => {
    async function run(filterOptions: Record<string, unknown>) {
      const captured: CapturedWhere[] = [];
      const repo = makeRepo(fakeQueryBuilder(captured));

      await repo.findAllWithPagination({
        filterOptions: filterOptions as never,
        sortOptions: null,
        paginationOptions: { page: 1, limit: 10 },
      });

      return captured;
    }

    it('should filters on the flag when Có is picked', async () => {
      const captured = await run({ isPopular: true });

      expect(captured).toEqual(
        expect.arrayContaining([
          {
            sql: 'blog.isPopular = :isPopular',
            params: { isPopular: true },
          },
        ]),
      );
    });

    it('should treats Không as a real choice, not as "all"', async () => {
      const captured = await run({ isPopular: false });

      expect(captured).toEqual(
        expect.arrayContaining([
          {
            sql: 'blog.isPopular = :isPopular',
            params: { isPopular: false },
          },
        ]),
      );
    });

    it('should adds no clause when nothing is picked', async () => {
      const captured = await run({});

      expect(captured.some((c) => c.sql.includes('isPopular'))).toBe(false);
    });

    it('should is independent of the Xuất bản filter', async () => {
      const captured = await run({ isPopular: true, isPublished: false });

      expect(captured).toEqual(
        expect.arrayContaining([
          { sql: 'blog.isPopular = :isPopular', params: { isPopular: true } },
          {
            sql: 'blog.isPublished = :isPublished',
            params: { isPublished: false },
          },
        ]),
      );
    });
  });

  describe('author options', () => {
    async function authors(rows: unknown[], lang?: string) {
      const captured: CapturedWhere[] = [];
      const repo = makeRepo(fakeQueryBuilder(captured, rows));
      return repo.findAuthorOptions(lang);
    }

    it('should uses the profile slug and name when there is a profile', async () => {
      const result = await authors([
        {
          profileSlug: 'nguyen-van-a',
          profileName: 'Nguyễn Văn A',
          byline: 'Nguyễn Văn A',
        },
      ]);

      expect(result).toEqual([{ slug: 'nguyen-van-a', name: 'Nguyễn Văn A' }]);
    });

    it('should derives a slug for a byline-only article', async () => {
      // Articles from before author profiles existed have no profile row; the
      // filter resolves them by the slug of their byline, so the option has to
      // carry that same slug or selecting it would return nothing.
      const result = await authors([
        { profileSlug: null, profileName: null, byline: 'Trần Thị B' },
      ]);

      expect(result).toEqual([{ slug: 'tran-thi-b', name: 'Trần Thị B' }]);
    });

    it('should collapses a profile and a matching byline into one option', async () => {
      const result = await authors([
        { profileSlug: null, profileName: null, byline: 'Nguyễn Văn A' },
        {
          profileSlug: 'nguyen-van-a',
          profileName: 'Nguyễn Văn A',
          byline: 'Nguyễn Văn A',
        },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('nguyen-van-a');
    });

    it('should skips rows with no name at all', async () => {
      const result = await authors([
        { profileSlug: null, profileName: null, byline: '   ' },
        { profileSlug: null, profileName: null, byline: null },
      ]);

      expect(result).toEqual([]);
    });

    it('should sorts by name the Vietnamese way', async () => {
      const result = await authors([
        { profileSlug: 'c', profileName: 'Cường', byline: null },
        { profileSlug: 'a', profileName: 'Ánh', byline: null },
        { profileSlug: 'b', profileName: 'Bình', byline: null },
      ]);

      expect(result.map((a) => a.name)).toEqual(['Ánh', 'Bình', 'Cường']);
    });

    it('should narrows to one language when asked', async () => {
      const captured: CapturedWhere[] = [];
      const repo = makeRepo(fakeQueryBuilder(captured, []));

      await repo.findAuthorOptions('vi');

      expect(captured).toEqual([
        { sql: 'blog.language = :lang', params: { lang: 'vi' } },
      ]);
    });
  });
});
