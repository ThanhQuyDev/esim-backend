import { blogSeoUrls } from './blog-seo-urls';

/** #055 — the SEO config that belongs to a blog post's page. */
describe('blogSeoUrls', () => {
  it('should use the unprefixed path for a Vietnamese post', () => {
    expect(
      blogSeoUrls({ slug: '/esim-trung-quoc-la-gi', language: 'vi' }),
    ).toEqual(['/blog/esim-trung-quoc-la-gi']);
  });

  it('should prefix the language for an English post', () => {
    expect(
      blogSeoUrls({
        slug: '/how-to-use-tiktok-in-china-without-being-blocked',
        language: 'en',
      }),
    ).toEqual(['/en/blog/how-to-use-tiktok-in-china-without-being-blocked']);
  });

  it('should not produce a double slash whether or not the slug has one', () => {
    expect(blogSeoUrls({ slug: 'bang-gia', language: 'vi' })).toEqual([
      '/blog/bang-gia',
    ]);
    expect(blogSeoUrls({ slug: '//bang-gia/', language: 'vi' })).toEqual([
      '/blog/bang-gia',
    ]);
  });

  it('should return nothing without a slug, so no broader config is touched', () => {
    expect(blogSeoUrls({ slug: '', language: 'vi' })).toEqual([]);
    expect(blogSeoUrls({ slug: '/', language: 'en' })).toEqual([]);
    expect(blogSeoUrls({ slug: null, language: 'vi' })).toEqual([]);
  });
});
