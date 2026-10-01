import { SiteScriptsService } from './site-scripts.service';
import { SITE_SCRIPT_PLACEMENTS } from './site-script-placements';

/**
 * Site-wide third-party scripts (#075).
 *
 * A script could previously only be attached to one page at a time through its
 * SEO record, which is useless for analytics. These rows go on every page, so what
 * the tests pin is that nothing an admin pasted can quietly fail to load: the
 * order they chose is preserved, and a row with a placement we do not recognise
 * still ends up on the page instead of being dropped.
 */
describe('SiteScriptsService', () => {
  const script = (over: Record<string, unknown>) => ({
    id: 'id',
    name: 'GA4',
    content: '<script>…</script>',
    placement: 'head',
    isActive: true,
    sortOrder: 0,
    ...over,
  });

  const makeService = (scripts: unknown[] = []) => {
    const siteScriptRepository = {
      create: jest.fn(),
      findAllWithPagination: jest.fn(),
      findActive: jest.fn().mockResolvedValue(scripts),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    return {
      service: new SiteScriptsService(siteScriptRepository as never),
      siteScriptRepository,
    };
  };

  describe('findActiveByPlacement', () => {
    it('should return every placement, including the empty ones', async () => {
      const { service } = makeService([]);

      const grouped = await service.findActiveByPlacement();

      expect(Object.keys(grouped).sort()).toEqual(
        [...SITE_SCRIPT_PLACEMENTS].sort(),
      );
      for (const key of SITE_SCRIPT_PLACEMENTS) {
        expect(grouped[key]).toEqual([]);
      }
    });

    it('should split the snippets by where they go', async () => {
      const { service } = makeService([
        script({ id: 'ga', placement: 'head' }),
        script({ id: 'chat', placement: 'bodyEnd' }),
        script({ id: 'gtm', placement: 'head' }),
      ]);

      const grouped = await service.findActiveByPlacement();

      expect(grouped.head.map((s) => s.id)).toEqual(['ga', 'gtm']);
      expect(grouped.bodyEnd.map((s) => s.id)).toEqual(['chat']);
    });

    it('should keep the order the admin chose', async () => {
      // A gtag config call has to run after the loader it configures, so this is
      // not cosmetic: reordering breaks the tag.
      const { service } = makeService([
        script({ id: 'loader', sortOrder: 0 }),
        script({ id: 'config', sortOrder: 1 }),
      ]);

      const grouped = await service.findActiveByPlacement();

      expect(grouped.head.map((s) => s.id)).toEqual(['loader', 'config']);
    });

    it('should still load a snippet whose placement is unrecognised', async () => {
      // A hand-edited row. The snippet was put there to run, so it falls back to
      // the head rather than silently never loading.
      const { service } = makeService([
        script({ id: 'odd', placement: 'footer' }),
      ]);

      const grouped = await service.findActiveByPlacement();

      expect(grouped.head.map((s) => s.id)).toEqual(['odd']);
      expect(grouped).not.toHaveProperty('footer');
    });
  });

  describe('create', () => {
    it('should default to the head, switched on, first in order', async () => {
      // Where Google's own install instructions put gtag.js and Tag Manager.
      const { service, siteScriptRepository } = makeService();

      await service.create({ name: 'GA4', content: '<script></script>' });

      expect(siteScriptRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          placement: 'head',
          isActive: true,
          sortOrder: 0,
        }),
      );
    });

    it('should keep the snippet exactly as pasted', async () => {
      // Rewriting a vendor snippet is how you break it.
      const pasted =
        '<!-- Google tag -->\n<script async src="https://x/gtag/js?id=G-1"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n</script>';
      const { service, siteScriptRepository } = makeService();

      await service.create({ name: 'GA4', content: pasted });

      expect(siteScriptRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: pasted }),
      );
    });

    it('should honour an explicit placement, order and off switch', async () => {
      const { service, siteScriptRepository } = makeService();

      await service.create({
        name: 'Chat widget',
        content: '<script></script>',
        placement: 'bodyEnd',
        sortOrder: 5,
        isActive: false,
      });

      expect(siteScriptRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          placement: 'bodyEnd',
          sortOrder: 5,
          isActive: false,
        }),
      );
    });
  });
});
