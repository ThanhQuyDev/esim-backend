import { MenuSlidesService } from './menu-slides.service';
import { MENU_SLIDE_KEYS } from './menu-slide-keys';

/**
 * The mega-menu slideshow, managed from the CMS (#073).
 *
 * The navbar asks for every active slide in one request and renders each panel's
 * carousel from its own group, so the grouping is what these tests pin: every
 * panel present even when empty (so the storefront can tell "nothing configured"
 * from "configured"), display order kept, and a stale panel name ignored rather
 * than returned as a group nothing renders.
 */
describe('MenuSlidesService', () => {
  const slide = (over: Record<string, unknown>) => ({
    id: 'id',
    title: 't',
    description: 'd',
    href: '/x',
    image: '/i.png',
    imageAlt: null,
    language: 'vi',
    sortOrder: 0,
    isActive: true,
    ...over,
  });

  const makeService = (slides: unknown[] = []) => {
    const menuSlideRepository = {
      create: jest.fn(),
      findAllWithPagination: jest.fn(),
      findActiveForMenus: jest.fn().mockResolvedValue(slides),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    return {
      service: new MenuSlidesService(menuSlideRepository as never),
      menuSlideRepository,
    };
  };

  describe('findGrouped', () => {
    it('should return every panel, including the empty ones', async () => {
      const { service } = makeService([]);

      const grouped = await service.findGrouped('vi');

      expect(Object.keys(grouped).sort()).toEqual([...MENU_SLIDE_KEYS].sort());
      for (const key of MENU_SLIDE_KEYS) {
        expect(grouped[key]).toEqual([]);
      }
    });

    it('should put each slide under its own panel', async () => {
      const { service } = makeService([
        slide({ id: 'a', menuKey: 'product' }),
        slide({ id: 'b', menuKey: 'help' }),
        slide({ id: 'c', menuKey: 'product' }),
      ]);

      const grouped = await service.findGrouped('vi');

      expect(grouped.product.map((s) => s.id)).toEqual(['a', 'c']);
      expect(grouped.help.map((s) => s.id)).toEqual(['b']);
      expect(grouped.offers).toEqual([]);
    });

    it('should keep the order the repository returned', async () => {
      // Display order is decided by the query (menuKey, sortOrder, createdAt);
      // grouping must not reshuffle it.
      const { service } = makeService([
        slide({ id: 'first', menuKey: 'offers', sortOrder: 0 }),
        slide({ id: 'second', menuKey: 'offers', sortOrder: 1 }),
        slide({ id: 'third', menuKey: 'offers', sortOrder: 2 }),
      ]);

      const grouped = await service.findGrouped('vi');

      expect(grouped.offers.map((s) => s.id)).toEqual([
        'first',
        'second',
        'third',
      ]);
    });

    it('should drop a slide whose panel no longer exists', async () => {
      // A renamed menu would otherwise leave rows in a group nothing renders.
      const { service } = makeService([
        slide({ id: 'stale', menuKey: 'pricing' }),
        slide({ id: 'good', menuKey: 'product' }),
      ]);

      const grouped = await service.findGrouped('vi');

      expect(grouped).not.toHaveProperty('pricing');
      expect(grouped.product.map((s) => s.id)).toEqual(['good']);
    });

    it('should give a panel only the slides of the asked language', async () => {
      const { service } = makeService([
        slide({ id: 'vi', menuKey: 'product', language: 'vi' }),
        slide({ id: 'en', menuKey: 'product', language: 'en' }),
      ]);

      const grouped = await service.findGrouped('en');

      expect(grouped.product.map((s) => s.id)).toEqual(['en']);
    });

    it('should fall back to the other language when a panel has none (vande #039)', async () => {
      const { service } = makeService([
        slide({ id: 'vi-only', menuKey: 'product', language: 'vi' }),
      ]);

      const grouped = await service.findGrouped('en');

      expect(grouped.product.map((s) => s.id)).toEqual(['vi-only']);
      expect(grouped.help).toEqual([]);
    });
  });

  describe('create', () => {
    it('should default the order and leave the slide switched on', async () => {
      const { service, menuSlideRepository } = makeService();

      await service.create({
        menuKey: 'product',
        title: 'eSIM Nhật Bản',
        description: 'Dữ liệu tốc độ cao',
        href: '/esim-nhat-ban',
        image: '/uploads/japan.png',
        language: 'vi',
      });

      expect(menuSlideRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sortOrder: 0,
          isActive: true,
          imageAlt: null,
        }),
      );
    });

    it('should keep an explicit order and an explicitly hidden slide', async () => {
      const { service, menuSlideRepository } = makeService();

      await service.create({
        menuKey: 'offers',
        title: 'Khuyến mãi Tết',
        description: 'Giảm 20%',
        href: '/khuyen-mai',
        image: '/uploads/tet.png',
        imageAlt: 'Khuyến mãi Tết',
        language: 'vi',
        sortOrder: 3,
        isActive: false,
      });

      expect(menuSlideRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sortOrder: 3,
          isActive: false,
          imageAlt: 'Khuyến mãi Tết',
        }),
      );
    });
  });
});
