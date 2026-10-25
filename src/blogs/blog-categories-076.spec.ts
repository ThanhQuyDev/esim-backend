import { BLOG_CATEGORY_SEED, blogCategorySlug } from './blog-categories';
import { BlogCategoriesService } from './blog-categories.service';

/** The made-in-advance blog categories (vande #076). */
describe('blog categories (vande #076)', () => {
  it('should hold the five parents and their 21 children from the brief', () => {
    expect(BLOG_CATEGORY_SEED.map((p) => p.vi)).toEqual([
      'Kết nối di động',
      'Thiết bị',
      'Du lịch',
      'Đánh giá & so sánh',
      'Phân tích',
    ]);
    expect(BLOG_CATEGORY_SEED.reduce((n, p) => n + p.children.length, 0)).toBe(
      21,
    );
  });

  it('should slug a name the way the storefront builds category URLs', () => {
    expect(blogCategorySlug('Kết nối di động')).toBe('ket-noi-di-dong');
    // The posts already written under "Kết Nối Di Động" keep the same address.
    expect(blogCategorySlug('Kết Nối Di Động')).toBe('ket-noi-di-dong');
    expect(blogCategorySlug('Đánh giá & so sánh')).toBe('danh-gia-so-sanh');
    expect(blogCategorySlug('What’s New')).toBe('whats-new');
    expect(blogCategorySlug('Pocket Wi-Fi')).toBe('pocket-wi-fi');
  });

  it('should give every child a slug unique within its parent', () => {
    for (const parent of BLOG_CATEGORY_SEED) {
      const slugs = parent.children.map((c) => blogCategorySlug(c.en));
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('should hand back parents with their children, in order', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        id: 1,
        parentId: null,
        nameEn: 'Devices',
        nameVi: 'Thiết bị',
        slugEn: 'devices',
        slugVi: 'thiet-bi',
      },
      {
        id: 2,
        parentId: 1,
        nameEn: 'iOS',
        nameVi: 'iOS',
        slugEn: 'ios',
        slugVi: 'ios',
      },
      {
        id: 3,
        parentId: 1,
        nameEn: 'Android',
        nameVi: 'Android',
        slugEn: 'android',
        slugVi: 'android',
      },
    ]);
    const tree = await new BlogCategoriesService({ query } as never).tree();
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.nameEn)).toEqual(['iOS', 'Android']);
    expect(tree[0]).not.toHaveProperty('parentId');
  });
});
