import { BlogCategoriesService } from './blog-categories.service';

/**
 * Blog categories kept up from the CMS (vande #076, Thọ 28/10: "có"). A post
 * stores its category's name, so a rename must carry its posts along and a
 * category still holding posts cannot be deleted.
 */

const CATEGORIES = [
  {
    id: 1,
    parentId: null,
    nameEn: 'Travel',
    nameVi: 'Du lịch',
    slugEn: 'travel',
    slugVi: 'du-lich',
  },
  {
    id: 2,
    parentId: 1,
    nameEn: 'Food',
    nameVi: 'Ẩm thực',
    slugEn: 'food',
    slugVi: 'am-thuc',
  },
  {
    id: 3,
    parentId: 1,
    nameEn: 'Safety',
    nameVi: 'An toàn',
    slugEn: 'safety',
    slugVi: 'an-toan',
  },
];
const POSTS = [
  { id: 10, language: 'vi', category: 'Du lịch', parent: 'Ẩm thực' },
  { id: 11, language: 'en', category: 'Travel', parent: 'Food' },
  { id: 12, language: 'vi', category: 'Du Lịch', parent: null },
  { id: 13, language: 'vi', category: 'Thiết bị', parent: 'Ẩm thực' },
];

function makeService(opts: { clash?: boolean } = {}) {
  const writes: [string, unknown[]][] = [];
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM blog_category WHERE id = $1')
    ) {
      return Promise.resolve(CATEGORIES.filter((c) => c.id === params[0]));
    }
    if (sql.includes('ORDER BY "sortOrder", id'))
      return Promise.resolve(CATEGORIES);
    if (sql.includes('GROUP BY language, category, parent')) {
      return Promise.resolve(POSTS.map((p) => ({ ...p, n: 1 })));
    }
    if (sql.includes('LIMIT 1')) {
      return Promise.resolve(opts.clash ? [{ nameVi: 'Ẩm thực' }] : []);
    }
    if (sql.startsWith('SELECT id, language, category, parent FROM blog')) {
      return Promise.resolve(POSTS);
    }
    writes.push([sql, params]);
    return Promise.resolve(sql.includes('RETURNING id') ? [{ id: 9 }] : []);
  });
  const dataSource = {
    query,
    transaction: (fn: (m: unknown) => unknown) => fn({ query }),
  };
  return { service: new BlogCategoriesService(dataSource as never), writes };
}

describe('Blog categories from the CMS (vande #076)', () => {
  it('should count the posts filed under each category', async () => {
    const [travel] = await makeService().service.tree();
    // "Du Lịch" (other spelling) counts too; "Thiết bị / Ẩm thực" does not.
    expect(travel.postCount).toBe(3);
    expect(travel.children.map((c) => [c.nameVi, c.postCount])).toEqual([
      ['Ẩm thực', 2],
      ['An toàn', 0],
    ]);
  });

  it('should add a child with the slugs of both names', async () => {
    const { service, writes } = makeService();
    await expect(
      service.create({ parentId: 1, nameVi: 'Lễ hội', nameEn: 'Festivals' }),
    ).resolves.toEqual({ id: 9 });
    expect(writes[0][1]).toEqual([
      1,
      'Festivals',
      'Lễ hội',
      'festivals',
      'le-hoi',
    ]);
  });

  it('should refuse a third level, a clash and an empty name', async () => {
    await expect(
      makeService().service.create({ parentId: 2, nameVi: 'X', nameEn: 'X' }),
    ).rejects.toThrow('Chỉ có 2 cấp');
    await expect(
      makeService({ clash: true }).service.create({
        parentId: 1,
        nameVi: 'Ẩm Thực',
        nameEn: 'Cuisine',
      }),
    ).rejects.toThrow('Đã có danh mục "Ẩm thực"');
    await expect(
      makeService().service.create({ nameVi: ' ', nameEn: 'Travel' }),
    ).rejects.toThrow('cả tiếng Việt và tiếng Anh');
  });

  it('should rename a child on its posts, each in its own language', async () => {
    const { service, writes } = makeService();
    const res = await service.rename(2, {
      nameVi: 'Ăn uống',
      nameEn: 'Food & Drink',
    });

    expect(res).toEqual({ postsUpdated: 2 });
    expect(writes.slice(1)).toEqual([
      ['UPDATE blog SET parent = $2 WHERE id = $1', [10, 'Ăn uống']],
      ['UPDATE blog SET parent = $2 WHERE id = $1', [11, 'Food & Drink']],
    ]);
  });

  it('should rename a parent on its posts', async () => {
    const { service, writes } = makeService();
    const res = await service.rename(1, {
      nameVi: 'Du lịch & khám phá',
      nameEn: 'Travel',
    });

    // The English post already reads "Travel"; post 13 is not in Travel.
    expect(res).toEqual({ postsUpdated: 2 });
    expect(writes.slice(1).map(([, p]) => p)).toEqual([
      [10, 'Du lịch & khám phá'],
      [12, 'Du lịch & khám phá'],
    ]);
  });

  it('should not delete a category posts are filed under', async () => {
    const { service, writes } = makeService();
    await expect(service.remove(2)).rejects.toThrow('Còn 2 bài viết');
    await service.remove(3);
    expect(writes).toEqual([['DELETE FROM blog_category WHERE id = $1', [3]]]);
  });
});
