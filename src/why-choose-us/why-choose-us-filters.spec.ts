import { WhyChooseUsRelationalRepository } from './infrastructure/persistence/relational/repositories/why-choose-us.repository';

/**
 * #054 — the Trang filter did nothing, and there was no status filter.
 *
 * The Trang break was entirely in the CMS: the table built `type` and the API
 * client never wrote it to the query string. The backend matching was already
 * right, so these tests pin it — a row's `type` column is itself a comma-separated
 * list, so "matches any of the selected pages" is a set intersection, not equality.
 */
describe('Why-choose-us list filters (#054)', () => {
  interface CapturedWhere {
    sql: string;
    params?: Record<string, unknown>;
  }

  function makeRepo(captured: CapturedWhere[]) {
    const qb: Record<string, jest.Mock> = {};
    const chain =
      (fn?: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        fn?.(...args);
        return qb;
      };

    qb.andWhere = jest.fn(
      chain((sql, params) =>
        captured.push({
          sql: String(sql),
          params: params as Record<string, unknown> | undefined,
        }),
      ),
    );
    qb.orderBy = jest.fn(chain());
    qb.addOrderBy = jest.fn(chain());
    qb.skip = jest.fn(chain());
    qb.take = jest.fn(chain());
    qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);

    return new WhyChooseUsRelationalRepository({
      createQueryBuilder: () => qb,
    } as never);
  }

  async function whereFor(filterOptions: Record<string, unknown>) {
    const captured: CapturedWhere[] = [];
    const repo = makeRepo(captured);
    await repo.findAllWithPagination({
      filterOptions: filterOptions as never,
      sortOptions: null,
      paginationOptions: { page: 1, limit: 10 },
    });
    return captured;
  }

  describe('Trang (page type)', () => {
    it('should matches a row whose type list holds the selected page', async () => {
      const captured = await whereFor({ type: 'trang_chu' });
      const clause = captured.find((c) => c.sql.includes('typePattern0'));

      // Wrapped in commas on both sides, so "quoc_gia" cannot match "quoc_gia_2".
      expect(clause?.params).toEqual({ typePattern0: '%,trang_chu,%' });
    });

    it('should ORs several pages, so picking two widens the result', async () => {
      const captured = await whereFor({ type: 'trang_chu,quoc_gia' });
      const clause = captured.find((c) => c.sql.includes('typePattern0'));

      expect(clause?.sql).toContain(' OR ');
      expect(clause?.params).toEqual({
        typePattern0: '%,trang_chu,%',
        typePattern1: '%,quoc_gia,%',
      });
    });

    it('should ignores blank entries instead of matching everything', async () => {
      const captured = await whereFor({ type: ' , , ' });

      expect(captured.some((c) => c.sql.includes('typePattern0'))).toBe(false);
    });

    it('should adds no clause when no page is selected', async () => {
      const captured = await whereFor({});

      expect(captured.some((c) => c.sql.includes('typePattern'))).toBe(false);
    });
  });

  describe('Trạng thái', () => {
    it('should filters on the flag when Hoạt động is picked', async () => {
      const captured = await whereFor({ isActive: true });

      expect(captured).toEqual(
        expect.arrayContaining([
          {
            sql: 'whyChooseUs.isActive = :isActive',
            params: { isActive: true },
          },
        ]),
      );
    });

    it('should treats Không hoạt động as a real choice, not as "all"', async () => {
      const captured = await whereFor({ isActive: false });

      expect(captured).toEqual(
        expect.arrayContaining([
          {
            sql: 'whyChooseUs.isActive = :isActive',
            params: { isActive: false },
          },
        ]),
      );
    });

    it('should adds no clause when no status is picked', async () => {
      const captured = await whereFor({});

      expect(captured.some((c) => c.sql.includes('isActive'))).toBe(false);
    });

    it('should combines with the page filter', async () => {
      const captured = await whereFor({ type: 'trang_chu', isActive: false });

      expect(captured.some((c) => c.sql.includes('typePattern0'))).toBe(true);
      expect(captured.some((c) => c.sql.includes('isActive'))).toBe(true);
    });
  });
});
