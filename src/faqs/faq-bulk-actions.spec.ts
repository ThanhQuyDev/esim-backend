import { FaqRelationalRepository } from './infrastructure/persistence/relational/repositories/faq.repository';

/**
 * #051 — row selection with bulk activate / deactivate / delete on the FAQ list.
 *
 * Same shape as the SEO config actions (#049) with two real differences: the id is
 * a uuid string rather than a number, and `faq` has no `deletedAt` column — so the
 * bulk delete is a HARD delete, matching what the single-row action already does.
 * Those two facts are what these tests pin.
 */
describe('FAQ bulk actions (#051)', () => {
  const ID_A = '0f7c2f3a-5f7a-4a1e-9d0b-6b2f9c8e4a11';
  const ID_B = '1a8d3e4b-6a8b-4b2f-8e1c-7c3f0d9f5b22';

  function makeRepo() {
    const update = jest.fn().mockResolvedValue({ affected: 2 });
    const del = jest.fn().mockResolvedValue({ affected: 2 });
    const softDelete = jest.fn();
    const repo = new FaqRelationalRepository(
      { update, delete: del, softDelete } as never,
      {} as never,
    );
    return { repo, update, del, softDelete };
  }

  /** The id list a TypeORM `In(...)` was built with. */
  function inValues(criteria: { id?: { _value?: unknown } }) {
    return criteria.id?._value;
  }

  describe('bulkSetActive', () => {
    it('should flips the whole selection in one statement', async () => {
      const { repo, update } = makeRepo();

      const affected = await repo.bulkSetActive([ID_A, ID_B], false);

      expect(update).toHaveBeenCalledTimes(1);
      expect(inValues(update.mock.calls[0][0])).toEqual([ID_A, ID_B]);
      expect(update.mock.calls[0][1]).toEqual({ isActive: false });
      expect(affected).toBe(2);
    });

    it('should can turn FAQs back on', async () => {
      const { repo, update } = makeRepo();

      await repo.bulkSetActive([ID_A], true);

      expect(update.mock.calls[0][1]).toEqual({ isActive: true });
    });

    it('should does nothing at all for an empty selection', async () => {
      // A criteria-less update would hit every row in the table.
      const { repo, update } = makeRepo();

      const affected = await repo.bulkSetActive([], false);

      expect(update).not.toHaveBeenCalled();
      expect(affected).toBe(0);
    });

    it('should drops blank ids instead of failing the whole statement', async () => {
      // An empty string reaching `IN (...)` makes Postgres reject the uuid cast,
      // which would take the valid rows down with it.
      const { repo, update } = makeRepo();

      await repo.bulkSetActive([ID_A, '', '   ', ID_B], false);

      expect(inValues(update.mock.calls[0][0])).toEqual([ID_A, ID_B]);
    });

    it('should de-duplicates, so a double-click cannot double-count', async () => {
      const { repo, update } = makeRepo();

      await repo.bulkSetActive([ID_A, ID_A, ID_B], true);

      expect(inValues(update.mock.calls[0][0])).toEqual([ID_A, ID_B]);
    });
  });

  describe('bulkRemove', () => {
    it('should hard-deletes, the same way the single-row delete does', async () => {
      // `faq` has no soft delete to match; pretending otherwise would leave the
      // rows visible on the storefront after an admin deleted them.
      const { repo, del, softDelete } = makeRepo();

      const affected = await repo.bulkRemove([ID_A, ID_B]);

      expect(del).toHaveBeenCalledTimes(1);
      expect(inValues(del.mock.calls[0][0])).toEqual([ID_A, ID_B]);
      expect(softDelete).not.toHaveBeenCalled();
      expect(affected).toBe(2);
    });

    it('should does nothing at all for an empty selection', async () => {
      const { repo, del } = makeRepo();

      const affected = await repo.bulkRemove([]);

      expect(del).not.toHaveBeenCalled();
      expect(affected).toBe(0);
    });

    it('should does nothing when every id was blank', async () => {
      const { repo, del } = makeRepo();

      const affected = await repo.bulkRemove(['', '  ']);

      expect(del).not.toHaveBeenCalled();
      expect(affected).toBe(0);
    });
  });
});
