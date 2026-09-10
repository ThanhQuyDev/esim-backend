import { resolveBlogPublishedAt } from './blogs.service';

describe('blog publication date', () => {
  const now = new Date('2026-09-02T03:00:00.000Z');

  it('should set a separate publication timestamp on first publish', () => {
    expect(
      resolveBlogPublishedAt({
        requestedIsPublished: true,
        currentIsPublished: false,
        currentPublishedAt: null,
        now,
      }),
    ).toEqual(now);
  });

  it('should keep the original publication date when content is edited later', () => {
    const original = new Date('2026-08-15T10:00:00.000Z');
    expect(
      resolveBlogPublishedAt({
        requestedIsPublished: true,
        currentIsPublished: true,
        currentPublishedAt: original,
        now,
      }),
    ).toEqual(original);
  });

  it('should honor a publication date explicitly selected in CMS', () => {
    const selected = new Date('2026-07-01T00:00:00.000Z');
    expect(
      resolveBlogPublishedAt({
        requestedPublishedAt: selected,
        requestedIsPublished: true,
        currentIsPublished: false,
        now,
      }),
    ).toEqual(selected);
  });

  it('should not assign a publication date to a draft', () => {
    expect(
      resolveBlogPublishedAt({
        requestedIsPublished: false,
        currentIsPublished: false,
        currentPublishedAt: null,
        now,
      }),
    ).toBeNull();
  });
});
