import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BlogsService } from './blogs.service';

/**
 * #011 — an author may only write and manage their own posts; an admin manages
 * every post and chooses which author a post is credited to.
 */
describe('BlogsService — author / admin permissions', () => {
  const AUTHOR = { id: 10, roleId: 3 };
  const ADMIN = { id: 1, roleId: 1 };
  const own = { id: 5, name: 'Đức Thọ', avatar: 'a.png', userId: 10 };
  const other = { id: 7, name: 'Lan Anh', avatar: 'b.png', userId: 20 };

  function setup(current: Record<string, unknown> | null = null) {
    const blogRepository = {
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      update: jest
        .fn()
        .mockImplementation((_id, data) => Promise.resolve(data)),
      findById: jest.fn().mockResolvedValue(current),
    };
    const authorsService = {
      findByUserId: jest
        .fn()
        .mockImplementation((userId: number) =>
          Promise.resolve(userId === 10 ? own : null),
        ),
      findById: jest
        .fn()
        .mockImplementation((id: number) =>
          Promise.resolve([own, other].find((p) => p.id === id) ?? null),
        ),
    };
    const service = new BlogsService(
      blogRepository as never,
      { findById: jest.fn() } as never,
      authorsService as never,
      {} as never,
    );
    return { service, blogRepository };
  }

  const dto = { language: 'vi', title: 'T', slug: 's' } as never;

  it('should credit an author with their own profile, ignoring any pick', async () => {
    const { service, blogRepository } = setup();
    await service.create(
      { ...(dto as object), authorProfileId: 7 } as never,
      AUTHOR,
    );
    expect(blogRepository.create.mock.calls[0][0].authorProfileId).toBe(5);
  });

  it('should let an admin credit the author they choose', async () => {
    const { service, blogRepository } = setup();
    await service.create(
      { ...(dto as object), authorProfileId: 7 } as never,
      ADMIN,
    );
    const saved = blogRepository.create.mock.calls[0][0];
    expect(saved.authorProfileId).toBe(7);
    expect(saved.author).toBe('Lan Anh');
  });

  it('should ask an admin without a profile to choose an author', async () => {
    const { service } = setup();
    await expect(service.create(dto, ADMIN)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it("should refuse an author editing someone else's post", async () => {
    const { service, blogRepository } = setup({ id: 'b', authorProfileId: 7 });
    await expect(
      service.update('b', { title: 'x' } as never, AUTHOR),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(blogRepository.update).not.toHaveBeenCalled();
  });

  it('should keep the credit when an admin edits a post without picking', async () => {
    const { service, blogRepository } = setup({ id: 'b', authorProfileId: 7 });
    await service.update('b', { title: 'x' } as never, ADMIN);
    const payload = blogRepository.update.mock.calls[0][1];
    expect(payload).not.toHaveProperty('authorProfileId');
    expect(payload).not.toHaveProperty('author');
  });

  it('should let an admin reassign a post to another author', async () => {
    const { service, blogRepository } = setup({ id: 'b', authorProfileId: 7 });
    await service.update('b', { authorProfileId: 5 } as never, ADMIN);
    expect(blogRepository.update.mock.calls[0][1].authorProfileId).toBe(5);
  });
});
