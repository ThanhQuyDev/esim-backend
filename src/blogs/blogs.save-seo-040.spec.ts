import { BlogsService } from './blogs.service';

const AUTHOR = { id: 1, roleId: 3 };

/**
 * vande #040 — an author's post got no SEO row: the post form wrote it through
 * the admin-only SEO API. The blog service now writes it on save.
 */
describe('BlogsService — SEO config on save (vande #040)', () => {
  const post = {
    id: 'blog-1',
    slug: '/esim-nhat-ban',
    language: 'vi',
    title: 'eSIM Nhật Bản',
    authorProfileId: 5,
  };

  function setup(existing: { id: number } | null = null) {
    const blogRepository = {
      findById: jest.fn().mockResolvedValue(post),
      update: jest.fn().mockResolvedValue(post),
    };
    const authorsService = {
      findByUserId: jest.fn().mockResolvedValue({ id: 5 }),
    };
    const seoConfigsService = {
      findByUrl: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    };
    const service = new BlogsService(
      blogRepository as never,
      {} as never,
      authorsService as never,
      seoConfigsService as never,
    );
    return { service, seoConfigsService };
  }

  it("should create the SEO row for an author's own post", async () => {
    const { service, seoConfigsService } = setup();

    await service.update(
      'blog-1',
      { seoTitle: 'eSIM Nhật Bản giá rẻ', seoDescription: 'Mô tả' },
      AUTHOR,
    );

    expect(seoConfigsService.create).toHaveBeenCalledWith({
      url: '/blog/esim-nhat-ban',
      metaTitle: 'eSIM Nhật Bản giá rẻ',
      metaDescription: 'Mô tả',
      metaKeywords: '',
      isActive: true,
    });
  });

  it('should update the existing row, only the fields filled in', async () => {
    const { service, seoConfigsService } = setup({ id: 9 });

    await service.update('blog-1', { seoKeywords: 'esim, nhật' }, AUTHOR);

    expect(seoConfigsService.update).toHaveBeenCalledWith(9, {
      metaKeywords: 'esim, nhật',
    });
    expect(seoConfigsService.create).not.toHaveBeenCalled();
  });

  it('should write nothing when no SEO field was filled in', async () => {
    const { service, seoConfigsService } = setup();

    await service.update('blog-1', { title: 'Mới' }, AUTHOR);

    expect(seoConfigsService.findByUrl).not.toHaveBeenCalled();
  });
});
