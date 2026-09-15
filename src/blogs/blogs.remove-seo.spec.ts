import { ForbiddenException } from '@nestjs/common';
import { BlogsService } from './blogs.service';

/**
 * #055 — "Nếu xóa bài viết thì tự động xóa data trong cấu hình SEO cho đỡ rác".
 */
describe('BlogsService.remove — SEO config cleanup', () => {
  function setup(
    blog: Record<string, unknown> | null = {
      id: 'blog-1',
      slug: '/esim-trung-quoc-la-gi',
      language: 'vi',
      authorProfileId: 5,
    },
  ) {
    const blogRepository = {
      findById: jest.fn().mockResolvedValue(blog),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const authorsService = {
      findByUserId: jest.fn().mockResolvedValue({ id: 5 }),
    };
    const seoConfigsService = {
      removeByUrls: jest.fn().mockResolvedValue(1),
    };
    const service = new BlogsService(
      blogRepository as never,
      {} as never,
      authorsService as never,
      seoConfigsService as never,
    );
    return { service, blogRepository, authorsService, seoConfigsService };
  }

  it("should delete the post and its page's SEO config", async () => {
    const { service, blogRepository, seoConfigsService } = setup();

    await service.remove('blog-1', 1);

    expect(blogRepository.remove).toHaveBeenCalledWith('blog-1');
    expect(seoConfigsService.removeByUrls).toHaveBeenCalledWith([
      '/blog/esim-trung-quoc-la-gi',
    ]);
  });

  it('should remove the English page config for an English post', async () => {
    const { service, seoConfigsService } = setup({
      id: 'blog-2',
      slug: '/how-to-use-tiktok-in-china',
      language: 'en',
      authorProfileId: 5,
    });

    await service.remove('blog-2', 1);

    expect(seoConfigsService.removeByUrls).toHaveBeenCalledWith([
      '/en/blog/how-to-use-tiktok-in-china',
    ]);
  });

  it('should still delete the post when the SEO cleanup fails', async () => {
    const { service, blogRepository, seoConfigsService } = setup();
    seoConfigsService.removeByUrls.mockRejectedValue(new Error('db down'));

    await expect(service.remove('blog-1', 1)).resolves.toBeUndefined();
    expect(blogRepository.remove).toHaveBeenCalledWith('blog-1');
  });

  it('should touch neither the post nor SEO when the user may not delete it', async () => {
    const { service, blogRepository, authorsService, seoConfigsService } =
      setup();
    authorsService.findByUserId.mockResolvedValue({ id: 99 });

    await expect(service.remove('blog-1', 1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(blogRepository.remove).not.toHaveBeenCalled();
    expect(seoConfigsService.removeByUrls).not.toHaveBeenCalled();
  });
});
