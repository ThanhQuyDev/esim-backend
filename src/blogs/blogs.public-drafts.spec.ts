import { NotFoundException } from '@nestjs/common';
import { BlogsController } from './blogs.controller';

/**
 * v3 #025 — "bị hiện bài viết chưa xuất bản trong phần bài viết liên quan".
 * The public blog API never hands out drafts; the CMS reads them as admin or
 * author.
 */
describe('BlogsController — drafts stay out of the public API', () => {
  function setup(blog: Record<string, unknown> | null) {
    const blogsService = {
      findAllWithPagination: jest.fn().mockResolvedValue([[], 0]),
      findById: jest.fn().mockResolvedValue(blog),
    };
    const controller = new BlogsController(blogsService as never, {} as never);
    return { controller, blogsService };
  }

  it('should list only published posts, whatever the query asks', async () => {
    const { controller, blogsService } = setup(null);
    await controller.findAll({
      filters: { isPublished: false } as never,
    } as never);
    expect(
      blogsService.findAllWithPagination.mock.calls[0][0].filterOptions
        .isPublished,
    ).toBe(true);
  });

  it('should hide a draft from an anonymous reader', async () => {
    const { controller } = setup({ id: 'b', isPublished: false });
    await expect(controller.findById('b', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should open a draft for the admin editor', async () => {
    const { controller } = setup({ id: 'b', isPublished: false });
    await expect(
      controller.findById('b', { user: { id: 1, role: { id: 1 } } }),
    ).resolves.toMatchObject({ id: 'b' });
  });

  it('should serve a published post to anyone', async () => {
    const { controller } = setup({ id: 'b', isPublished: true });
    await expect(controller.findById('b', {})).resolves.toMatchObject({
      id: 'b',
    });
  });
});
