/**
 * Site-wide third-party scripts — Google Analytics, Tag Manager, Ads (#075).
 *
 * Scripts could only be attached to one page at a time, through
 * `seo_config.structuredData`. Analytics has to be on every page to be worth
 * anything, and there is no realistic way to paste it into every record by hand —
 * nor to remember to do it for each new page. These rows are injected on every
 * page instead, with no URL to maintain.
 */
export const SITE_SCRIPT_PLACEMENTS = ['head', 'bodyEnd'] as const;

export type SiteScriptPlacement = (typeof SITE_SCRIPT_PLACEMENTS)[number];

/**
 * `head` is where Google's own install instructions put gtag.js and the Tag
 * Manager snippet, so it is the default. `bodyEnd` exists for anything that must
 * not block the first paint.
 */
export const DEFAULT_SITE_SCRIPT_PLACEMENT: SiteScriptPlacement = 'head';
