import { ManufacturerNotesService } from './manufacturer-notes.service';

/**
 * Per-brand notes on the supported-devices page (#079).
 *
 * The page could only ever show one note — a string in the storefront's locale
 * file, hard-coded to appear under "iPhone". The brand name is now typed by hand
 * in two separate places (the device rows and the note), so what these tests pin
 * is that a note still finds its brand when the two are typed differently, and
 * that a note for one language never leaks into the other.
 */
describe('ManufacturerNotesService', () => {
  const note = (over: Record<string, unknown>) => ({
    id: 'id',
    manufacturer: 'iPhone',
    language: 'vi',
    note: 'Lưu ý',
    isActive: true,
    ...over,
  });

  const makeService = (notes: unknown[] = []) => {
    const noteRepository = {
      create: jest.fn(),
      findAllWithPagination: jest.fn(),
      findActiveByLanguage: jest.fn().mockResolvedValue(notes),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    return {
      service: new ManufacturerNotesService(noteRepository as never),
      noteRepository,
    };
  };

  describe('findActiveMap', () => {
    it('should key a note by its brand', async () => {
      const { service } = makeService([
        note({ manufacturer: 'iPhone', note: 'Lưu ý iPhone' }),
        note({ manufacturer: 'Samsung', note: 'Lưu ý Samsung' }),
      ]);

      const map = await service.findActiveMap('vi');

      expect(map.get('iphone')).toBe('Lưu ý iPhone');
      expect(map.get('samsung')).toBe('Lưu ý Samsung');
    });

    it('should match a brand however it was typed', async () => {
      // The brand is typed by hand on the device rows and again on the note, so
      // "IPHONE" against "iPhone" must not silently fail to show the note.
      const { service } = makeService([
        note({ manufacturer: '  IPHONE  ', note: 'Lưu ý' }),
      ]);

      const map = await service.findActiveMap('vi');

      expect(map.get('iphone')).toBe('Lưu ý');
    });

    it('should ask for one language only', async () => {
      // A Vietnamese note must never appear on the English page.
      const { service, noteRepository } = makeService([]);

      await service.findActiveMap('en');

      expect(noteRepository.findActiveByLanguage).toHaveBeenCalledWith('en');
    });

    it('should fall back to Vietnamese when no language is given', async () => {
      const { service, noteRepository } = makeService([]);

      await service.findActiveMap(undefined);
      await service.findActiveMap('');

      expect(noteRepository.findActiveByLanguage).toHaveBeenNthCalledWith(
        1,
        'vi',
      );
      expect(noteRepository.findActiveByLanguage).toHaveBeenNthCalledWith(
        2,
        'vi',
      );
    });

    it('should be empty when nothing is configured', async () => {
      const { service } = makeService([]);

      expect((await service.findActiveMap('vi')).size).toBe(0);
    });
  });

  describe('create', () => {
    it('should trim the brand so it matches the device rows', async () => {
      const { service, noteRepository } = makeService();

      await service.create({
        manufacturer: '  Samsung  ',
        language: 'vi',
        note: 'Lưu ý',
      });

      expect(noteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ manufacturer: 'Samsung', isActive: true }),
      );
    });

    it('should let a note be prepared switched off', async () => {
      const { service, noteRepository } = makeService();

      await service.create({
        manufacturer: 'Google',
        language: 'en',
        note: 'Pixel caveat',
        isActive: false,
      });

      expect(noteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });
});
