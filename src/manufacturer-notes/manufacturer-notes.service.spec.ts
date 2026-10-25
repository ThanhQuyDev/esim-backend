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
      findActive: jest.fn().mockResolvedValue(notes),
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
    it('should key notes by their brand', async () => {
      const { service } = makeService([
        note({ manufacturer: 'iPhone', note: 'Lưu ý iPhone' }),
        note({ manufacturer: 'Samsung', note: 'Lưu ý Samsung' }),
      ]);

      const map = await service.findActiveMap('vi');

      expect(map.get('iphone')).toEqual(['Lưu ý iPhone']);
      expect(map.get('samsung')).toEqual(['Lưu ý Samsung']);
    });

    it('should keep several notes for one brand, in order (vande #042)', async () => {
      const { service } = makeService([
        note({ manufacturer: 'iPhone', note: 'Bản Trung Quốc không có eSIM' }),
        note({ manufacturer: 'iPhone', note: 'iPhone 14 Mỹ chỉ có eSIM' }),
      ]);

      const map = await service.findActiveMap('vi');

      expect(map.get('iphone')).toEqual([
        'Bản Trung Quốc không có eSIM',
        'iPhone 14 Mỹ chỉ có eSIM',
      ]);
    });

    it('should match a brand however it was typed', async () => {
      // The brand is typed by hand on the device rows and again on the note, so
      // "IPHONE" against "iPhone" must not silently fail to show the note.
      const { service } = makeService([
        note({ manufacturer: '  IPHONE  ', note: 'Lưu ý' }),
      ]);

      const map = await service.findActiveMap('vi');

      expect(map.get('iphone')).toEqual(['Lưu ý']);
    });

    it("should prefer the page's language and borrow the other's only when a brand has none", async () => {
      const { service } = makeService([
        note({ manufacturer: 'iPhone', language: 'vi', note: 'VI' }),
        note({ manufacturer: 'iPhone', language: 'en', note: 'EN' }),
        note({ manufacturer: 'Samsung', language: 'vi', note: 'Chỉ VI' }),
      ]);

      const map = await service.findActiveMap('en');

      expect(map.get('iphone')).toEqual(['EN']);
      expect(map.get('samsung')).toEqual(['Chỉ VI']);
    });

    it('should read Vietnamese as the default language', async () => {
      const { service } = makeService([
        note({ language: 'vi', note: 'VI' }),
        note({ language: 'en', note: 'EN' }),
      ]);

      expect((await service.findActiveMap(undefined)).get('iphone')).toEqual([
        'VI',
      ]);
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
