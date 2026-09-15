/**
 * The SEO-config URL a blog post's page is looked up under (#055).
 *
 * Mirrors the storefront (`app/[locale]/blog/[slug]`): the default language
 * has no prefix (`/blog/<slug>`), others do (`/en/blog/<slug>`). Slugs are
 * stored with a leading slash (`/esim-trung-quoc-la-gi`), which must not turn
 * into `/blog//…`.
 */
export const DEFAULT_BLOG_LANGUAGE = 'vi';

export function blogSeoUrls(blog: {
  slug?: string | null;
  language?: string | null;
}): string[] {
  const slug = (blog.slug ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (!slug) return [];

  const language = (blog.language ?? DEFAULT_BLOG_LANGUAGE)
    .trim()
    .toLowerCase();
  return language === DEFAULT_BLOG_LANGUAGE || !language
    ? [`/blog/${slug}`]
    : [`/${language}/blog/${slug}`];
}
