import { SeoConfigsRelationalRepository } from './infrastructure/persistence/relational/repositories/seo-config.repository';

/**
 * #049 — row selection with bulk activate / deactivate / delete.
 *
 * The risks are all in the id list: an empty selection must not become "every
 * row", a junk id must not take the valid rows down with it, and the delete has
 * to be the same soft delete the single-row action performs — a hard delete would
 * strip the SEO of every page in the selection with no way back.
 */
describe('SEO config bulk actions (#049)', () => {
  function makeRepo() {
    const update = jest.fn().mockResolvedValue({ affected: 2 });
    const softDelete = jest.fn().mockResolvedValue({ affected: 2 });
    const repo = new SeoConfigsRelationalRepository({
      update,
      softDelete,
    } as never);
    return { repo, update, softDelete };
  }

  /** The id list a TypeORM `In(...)` was built with. */
  function inValues(criteria: { id?: { _value?: unknown } }) {
    return criteria.id?._value;
  }

  describe('bulkSetActive', () => {
    it('should flips the whole selection in one statement', async () => {
      const { repo, update } = makeRepo();

      const affected = await repo.bulkSetActive([3, 1, 2], false);

      expect(update).toHaveBeenCalledTimes(1);
      expect(inValues(update.mock.calls[0][0])).toEqual([3, 1, 2]);
      expect(update.mock.calls[0][1]).toEqual({ isActive: false });
      expect(affected).toBe(2);
    });

    it('should can turn configs back on', async () => {
      const { repo, update } = makeRepo();

      await repo.bulkSetActive([1], true);

      expect(update.mock.calls[0][1]).toEqual({ isActive: true });
    });

    it('should does nothing at all for an empty selection', async () => {
      // An `IN ()` or a criteria-less update would hit every row in the table.
      const { repo, update } = makeRepo();

      const affected = await repo.bulkSetActive([], false);

      expect(update).not.toHaveBeenCalled();
      expect(affected).toBe(0);
    });

    it('should drops junk ids instead of failing the whole statement', async () => {
      const { repo, update } = makeRepo();

      await repo.bulkSetActive([1, 0, -5, 2.5, NaN as never, 2], false);

      expect(inValues(update.mock.calls[0][0])).toEqual([1, 2]);
    });

    it('should de-duplicates, so a double-click cannot double-count', async () => {
      const { repo, update } = makeRepo();

      await repo.bulkSetActive([1, 1, 2], true);

      expect(inValues(update.mock.calls[0][0])).toEqual([1, 2]);
    });

    it('should does nothing when every id was junk', async () => {
      const { repo, update } = makeRepo();

      const affected = await repo.bulkSetActive([0, -1] as never, false);

      expect(update).not.toHaveBeenCalled();
      expect(affected).toBe(0);
    });
  });

  describe('bulkRemove', () => {
    it('should soft-deletes, the same way the single-row delete does', async () => {
      const { repo, softDelete } = makeRepo();

      const affected = await repo.bulkRemove([1, 2]);

      expect(softDelete).toHaveBeenCalledTimes(1);
      expect(inValues(softDelete.mock.calls[0][0])).toEqual([1, 2]);
      expect(affected).toBe(2);
    });

    it('should does nothing at all for an empty selection', async () => {
      const { repo, softDelete } = makeRepo();

      const affected = await repo.bulkRemove([]);

      expect(softDelete).not.toHaveBeenCalled();
      expect(affected).toBe(0);
    });

    it('should drops junk ids', async () => {
      const { repo, softDelete } = makeRepo();

      await repo.bulkRemove([5, 0, 6]);

      expect(inValues(softDelete.mock.calls[0][0])).toEqual([5, 6]);
    });
  });
});
