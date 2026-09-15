import { BlogsService } from './blogs.service';
import type { LegacyBlogAuthor } from './infrastructure/persistence/blog.repository';

/**
 * The author page for articles that predate author profiles (#030).
 *
 * Every article on the site so far carries only a byline ("Duc Tho", "Đức Thọ")
 * and no profile, so `/blog/author/duc-tho` answered 404 and listed nothing —
 * the tester saw no author page at all.
 */

function makeService(opts: {
  profiles?: Record<string, unknown>[];
  legacy?: LegacyBlogAuthor[];
}) {
  const blogRepository = {
    findLegacyAuthors: jest.fn().mockResolvedValue(opts.legacy ?? []),
    findAllWithPagination: jest.fn().mockResolvedValue([[], 0]),
  };
  const authorsService = {
    findBySlug: jest.fn((slug: string) =>
      Promise.resolve(
        (opts.profiles ?? []).find((profile) => profile.slug === slug) ?? null,
      ),
    ),
  };

  const service = new BlogsService(
    blogRepository as never,
    {} as never,
    authorsService as never,
    {} as never,
  );
  return { service, blogRepository };
}

const LEGACY: LegacyBlogAuthor[] = [
  { name: 'Duc Tho', avatar: 'https://cdn.esim.vn/tho.png', blogs: 16 },
  { name: 'Đức Thọ', avatar: null, blogs: 1 },
  { name: 'Someone Else', avatar: null, blogs: 3 },
];

describe('Author page for pre-profile articles', () => {
  it('should resolve a byline slug to an author instead of a 404', async () => {
    const { service } = makeService({ legacy: LEGACY });

    await expect(service.findAuthorBySlug('duc-tho')).resolves.toMatchObject({
      name: 'Duc Tho',
      slug: 'duc-tho',
      avatar: 'https://cdn.esim.vn/tho.png',
    });
  });

  it('should prefer a real author profile over a byline', async () => {
    const profile = { id: 4, userId: 9, name: 'Đức Thọ', slug: 'duc-tho' };
    const { service } = makeService({ profiles: [profile], legacy: LEGACY });

    await expect(service.findAuthorBySlug('duc-tho')).resolves.toBe(profile);
  });

  it('should still answer nothing for an author nobody wrote as', async () => {
    const { service } = makeService({ legacy: LEGACY });

    await expect(service.findAuthorBySlug('ai-do')).resolves.toBeNull();
  });

  it('should list the byline articles, in every spelling, on the author page', async () => {
    const { service, blogRepository } = makeService({ legacy: LEGACY });

    await service.findAllWithPagination({
      filterOptions: { authorSlug: 'Đức Thọ' },
      paginationOptions: { page: 1, limit: 20 },
    });

    expect(blogRepository.findAllWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        filterOptions: expect.objectContaining({
          authorSlug: 'duc-tho',
          legacyAuthorNames: ['Duc Tho', 'Đức Thọ'],
        }),
      }),
    );
  });

  it('should leave other listings untouched', async () => {
    const { service, blogRepository } = makeService({ legacy: LEGACY });

    await service.findAllWithPagination({
      filterOptions: { category: 'eSIM' },
      paginationOptions: { page: 1, limit: 20 },
    });

    expect(blogRepository.findLegacyAuthors).not.toHaveBeenCalled();
    expect(blogRepository.findAllWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({ filterOptions: { category: 'eSIM' } }),
    );
  });
});
