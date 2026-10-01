/**
 * The mega-menu panels that carry a slideshow (#073).
 *
 * The storefront navbar has four dropdown panels, each ending in an "Explore"
 * carousel. Until now those cards were hard-coded in `navbar.tsx` — still
 * pointing at the reference design's NordVPN CDN images — so nobody but a
 * developer could change the pictures or the wording.
 *
 * The keys are the panel names the navbar already uses, so a slide's panel is
 * named the same thing in the CMS, the API and the component.
 */
export const MENU_SLIDE_KEYS = [
  'product',
  'resources',
  'offers',
  'help',
] as const;

export type MenuSlideKey = (typeof MENU_SLIDE_KEYS)[number];

/** Languages the storefront menu is rendered in. */
export const MENU_SLIDE_LANGUAGES = ['en', 'vi'] as const;
