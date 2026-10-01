/**
 * Which entity a SEO config's URL points at (#048).
 *
 * The "Loại trang" column is derived from `destinationId` / `regionId` /
 * `planId`, so a config created by typing only a URL showed as "Trang khác" even
 * when it was plainly a destination page. Nothing in the URL was wrong — the link
 * was simply never made.
 *
 * Destination and region detail pages are single-segment slugs on the storefront
 * (`/esim-nhat-ban`, `/en/esim-japan` — see `i18n/routing.ts`, `'/[slug]'`), so
 * the URL alone cannot say which of the two it is: that takes a lookup against
 * the slug columns. This module does the parsing; the service does the lookup.
 */

/** Locale prefixes the storefront uses; `vi` has none, `en` is `/en`. */
const LOCALE_SEGMENTS = new Set(['en', 'vi']);

/** The shared per-type configs that the storefront falls back to. */
const TYPE_PAGES: Record<string, 'destination' | 'region'> = {
  destination: 'destination',
  destinations: 'destination',
  region: 'region',
  regions: 'region',
};

function segmentsOf(url: string): string[] {
  return url
    .trim()
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The slug a single-segment URL points at, or null when the URL is not of that
 * shape (`/`, `/blog`, `/blog/abc`, `/en/help-center/...`).
 *
 * A locale prefix is stripped first, so `/en/esim-japan` and `/esim-nhat-ban`
 * both yield their slug.
 */
export function seoUrlSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  const segments = segmentsOf(url);
  const withoutLocale =
    segments.length > 1 && LOCALE_SEGMENTS.has(segments[0])
      ? segments.slice(1)
      : segments;

  if (withoutLocale.length !== 1) return null;
  const slug = withoutLocale[0];
  // The shared type pages are handled by `seoUrlTypePage`, not as a slug.
  return TYPE_PAGES[slug] ? null : slug;
}

/**
 * `destination` / `region` when the URL IS the shared type page
 * (`/destination`, `/en/region`), otherwise null. These need no lookup: they are
 * about that kind of page rather than about one country or area.
 */
export function seoUrlTypePage(
  url: string | null | undefined,
): 'destination' | 'region' | null {
  if (!url) return null;
  const segments = segmentsOf(url);
  const withoutLocale =
    segments.length > 1 && LOCALE_SEGMENTS.has(segments[0])
      ? segments.slice(1)
      : segments;

  if (withoutLocale.length !== 1) return null;
  return TYPE_PAGES[withoutLocale[0]] ?? null;
}
