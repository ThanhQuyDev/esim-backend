import { seoUrlSlug, seoUrlTypePage } from './seo-config-page-target';
import { SeoConfigsService } from './seo-configs.service';

/**
 * #048 — "Loại trang" showed "Trang khác" for country and area pages.
 *
 * The column is derived from `destinationId` / `regionId` / `planId`, and a config
 * created by typing only a URL had all three null. The service now infers the
 * link from the URL.
 *
 * The parsing is the part that has to be exactly right: a destination page and a
 * region page are both single-segment slugs on the storefront, so anything with
 * more segments (a blog post, the help centre) must NOT be treated as one.
 */
describe('SEO url → page target (#048)', () => {
  describe('seoUrlSlug', () => {
    it('should reads the slug of a single-segment page', () => {
      expect(seoUrlSlug('/esim-nhat-ban')).toBe('esim-nhat-ban');
      expect(seoUrlSlug('esim-nhat-ban')).toBe('esim-nhat-ban');
      expect(seoUrlSlug('/esim-nhat-ban/')).toBe('esim-nhat-ban');
    });

    it('should strips the locale prefix', () => {
      expect(seoUrlSlug('/en/esim-japan')).toBe('esim-japan');
      expect(seoUrlSlug('/vi/esim-nhat-ban')).toBe('esim-nhat-ban');
    });

    it('should ignores query strings and fragments', () => {
      expect(seoUrlSlug('/esim-nhat-ban?utm=x')).toBe('esim-nhat-ban');
      expect(seoUrlSlug('/esim-nhat-ban#plans')).toBe('esim-nhat-ban');
    });

    it('should is null for anything that is not a single-segment page', () => {
      // A blog post or a help article is genuinely "Trang khác"; treating its
      // first segment as a slug would mislabel it.
      expect(seoUrlSlug('/')).toBeNull();
      expect(seoUrlSlug('/blog/esim-nhat-ban')).toBeNull();
      expect(seoUrlSlug('/en/help-center/how-to')).toBeNull();
      expect(seoUrlSlug('')).toBeNull();
      expect(seoUrlSlug(null)).toBeNull();
    });

    it('should is null for the shared type pages', () => {
      // `/destination` is about a kind of page, not one country, so it stays
      // unlinked rather than being matched against a slug.
      expect(seoUrlSlug('/destination')).toBeNull();
      expect(seoUrlSlug('/en/region')).toBeNull();
    });

    it('should lower-cases, because slugs are stored lower-case', () => {
      expect(seoUrlSlug('/eSIM-Nhat-Ban')).toBe('esim-nhat-ban');
    });
  });

  describe('seoUrlTypePage', () => {
    it('should recognises the shared destination and region pages', () => {
      expect(seoUrlTypePage('/destination')).toBe('destination');
      expect(seoUrlTypePage('/destinations')).toBe('destination');
      expect(seoUrlTypePage('/en/region')).toBe('region');
      expect(seoUrlTypePage('/regions')).toBe('region');
    });

    it('should is null for a country page or anything else', () => {
      expect(seoUrlTypePage('/esim-nhat-ban')).toBeNull();
      expect(seoUrlTypePage('/blog/x')).toBeNull();
      expect(seoUrlTypePage(null)).toBeNull();
    });
  });

  describe('inferring the link on create', () => {
    function makeService(opts: {
      destination?: { id: number } | null;
      region?: { id: number } | null;
    }) {
      const created: Record<string, unknown>[] = [];
      const service = Object.create(
        SeoConfigsService.prototype,
      ) as SeoConfigsService;
      const internals = service as unknown as Record<string, unknown>;

      internals.seoConfigsRepository = {
        findByUrl: jest.fn().mockResolvedValue(null),
        create: jest.fn((row: Record<string, unknown>) => {
          created.push(row);
          return Promise.resolve({ id: 1, ...row });
        }),
      };
      internals.destinationsService = {
        findBySlug: jest.fn().mockResolvedValue(opts.destination ?? null),
      };
      internals.regionsService = {
        findBySlug: jest.fn().mockResolvedValue(opts.region ?? null),
      };

      return { service, created, internals };
    }

    const BASE = { url: '/esim-nhat-ban', metaTitle: 'Title' } as never;

    it('should links a country page to its destination', async () => {
      const { service, created } = makeService({ destination: { id: 7 } });

      await service.create(BASE);

      expect(created[0]).toMatchObject({ destinationId: 7, regionId: null });
    });

    it('should links an area page to its region', async () => {
      const { service, created } = makeService({ region: { id: 3 } });

      await service.create(BASE);

      expect(created[0]).toMatchObject({ destinationId: null, regionId: 3 });
    });

    it('should prefers a destination when a slug could be either', async () => {
      const { service, created, internals } = makeService({
        destination: { id: 7 },
        region: { id: 3 },
      });

      await service.create(BASE);

      expect(created[0]).toMatchObject({ destinationId: 7, regionId: null });
      // …and does not waste a second lookup once it has a hit.
      expect(
        (internals.regionsService as { findBySlug: jest.Mock }).findBySlug,
      ).not.toHaveBeenCalled();
    });

    it('should never overrides a link the admin picked', async () => {
      // An admin pointing a config somewhere unusual on purpose must win.
      const { service, created, internals } = makeService({
        destination: { id: 7 },
      });

      await service.create({ ...(BASE as object), regionId: 99 } as never);

      expect(created[0]).toMatchObject({ destinationId: null, regionId: 99 });
      expect(
        (internals.destinationsService as { findBySlug: jest.Mock }).findBySlug,
      ).not.toHaveBeenCalled();
    });

    it('should leaves a genuine "other" page unlinked', async () => {
      const { service, created } = makeService({});

      await service.create({ url: '/blog/abc', metaTitle: 'T' } as never);

      expect(created[0]).toMatchObject({
        destinationId: null,
        regionId: null,
        planId: null,
      });
    });

    it('should leaves an unknown slug unlinked rather than guessing', async () => {
      const { service, created } = makeService({});

      await service.create(BASE);

      expect(created[0]).toMatchObject({ destinationId: null, regionId: null });
    });
  });
});
