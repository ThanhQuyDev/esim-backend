import { plainToInstance } from 'class-transformer';
import { QueryBlogDto } from './find-all-blogs.dto';

describe('QueryBlogDto publication filter', () => {
  it('should preserve isPublished=true for public related-post queries', () => {
    const query = plainToInstance(QueryBlogDto, {
      filters: JSON.stringify({ isPublished: true }),
    });

    expect(query.filters).toEqual(
      expect.objectContaining({ isPublished: true }),
    );
  });

  it('should preserve isPublished=false for CMS draft filtering', () => {
    const query = plainToInstance(QueryBlogDto, {
      filters: JSON.stringify({ isPublished: false }),
    });

    expect(query.filters).toEqual(
      expect.objectContaining({ isPublished: false }),
    );
  });
});
