import { AuthorsService } from './authors.service';
import type { AuthorProfile } from './domain/author-profile';

/**
 * Author profiles (#059) — the record behind the author box at the end of every
 * article and behind `/blog/author/<slug>`.
 *
 * The CMS user form now writes these, so the rules that decide what gets saved
 * are worth pinning: the slug IS the public URL, and two authors sharing one
 * would make a page list the wrong person's articles.
 */

function makeService(existing: AuthorProfile[] = []) {
  const saved: AuthorProfile[] = [];

  const repository = {
    findByUserId: jest.fn((userId: number) =>
      Promise.resolve(existing.find((a) => a.userId === userId) ?? null),
    ),
    findBySlug: jest.fn((slug: string) =>
      Promise.resolve(existing.find((a) => a.slug === slug) ?? null),
    ),
    save: jest.fn((profile: AuthorProfile) => {
      saved.push(profile);
      return Promise.resolve({ ...profile, id: profile.id ?? 1 });
    }),
  };

  return {
    service: new AuthorsService(repository as never),
    saved,
    repository,
  };
}

const PROFILE = {
  name: 'Nguyễn Văn A',
  slug: 'Nguyễn Văn A',
  avatar: 'https://cdn.esim.vn/a.jpg',
  description: 'Biên tập viên du lịch',
};

describe('Saving an author profile', () => {
  it('should turn a Vietnamese name into a clean URL slug', async () => {
    const { service, saved } = makeService();

    await service.upsertForUser(7, PROFILE);

    // Accents and đ removed, spaces hyphenated — this string becomes the page URL.
    expect(saved[0].slug).toBe('nguyen-van-a');
  });

  it('should keep the name, avatar and summary as written', async () => {
    const { service, saved } = makeService();

    await service.upsertForUser(7, PROFILE);

    expect(saved[0]).toMatchObject({
      userId: 7,
      name: 'Nguyễn Văn A',
      avatar: 'https://cdn.esim.vn/a.jpg',
      description: 'Biên tập viên du lịch',
    });
  });

  it('should store blank avatar and summary as null, not empty strings', async () => {
    const { service, saved } = makeService();

    await service.upsertForUser(7, {
      ...PROFILE,
      avatar: '   ',
      description: '',
    });

    expect(saved[0].avatar).toBeNull();
    expect(saved[0].description).toBeNull();
  });

  it('should refuse a slug another author already owns', async () => {
    const { service } = makeService([
      { id: 1, userId: 3, name: 'Người khác', slug: 'nguyen-van-a' },
    ]);

    // Two authors on one URL would list the wrong person's articles.
    await expect(service.upsertForUser(7, PROFILE)).rejects.toThrow();
  });

  it('should let an author keep their own slug when editing', async () => {
    const existing = {
      id: 5,
      userId: 7,
      name: 'Nguyễn Văn A',
      slug: 'nguyen-van-a',
    };
    const { service, saved } = makeService([existing]);

    await service.upsertForUser(7, { ...PROFILE, description: 'Đã sửa' });

    // Updates the same row rather than creating a second profile.
    expect(saved[0].id).toBe(5);
    expect(saved[0].description).toBe('Đã sửa');
  });

  it('should keep the English name and summary, blank ones as null (#025)', async () => {
    const { service, saved } = makeService();

    await service.upsertForUser(7, {
      ...PROFILE,
      nameEn: '  Nguyen Van A ',
      descriptionEn: 'Travel editor',
    });
    await service.upsertForUser(8, {
      ...PROFILE,
      slug: 'other',
      nameEn: '  ',
      descriptionEn: '',
    });

    expect(saved[0]).toMatchObject({
      nameEn: 'Nguyen Van A',
      descriptionEn: 'Travel editor',
    });
    expect(saved[1].nameEn).toBeNull();
    expect(saved[1].descriptionEn).toBeNull();
  });

  it('should trim a pasted name instead of saving the spaces', async () => {
    const { service, saved } = makeService();

    await service.upsertForUser(7, { ...PROFILE, name: '  Trần Bình  ' });

    expect(saved[0].name).toBe('Trần Bình');
  });
});

describe('Looking an author up', () => {
  it('should find them by an untidy slug from the URL', async () => {
    const { service, repository } = makeService([
      { id: 1, userId: 7, name: 'Nguyễn Văn A', slug: 'nguyen-van-a' },
    ]);

    await expect(service.findBySlug(' Nguyễn Văn A ')).resolves.toMatchObject({
      userId: 7,
    });
    expect(repository.findBySlug).toHaveBeenCalledWith('nguyen-van-a');
  });

  it('should return nothing for an unknown author', async () => {
    const { service } = makeService();

    await expect(service.findBySlug('ai-do')).resolves.toBeNull();
    await expect(service.findByUserId(99)).resolves.toBeNull();
  });
});
