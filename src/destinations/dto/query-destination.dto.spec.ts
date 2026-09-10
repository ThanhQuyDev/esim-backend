import { plainToInstance } from 'class-transformer';
import { QueryDestinationDto } from './query-destination.dto';

describe('QueryDestinationDto', () => {
  it('should preserve a null parentId filter for root destinations', () => {
    const query = plainToInstance(QueryDestinationDto, {
      filters: JSON.stringify({ parentId: null }),
    });

    expect(query.filters).toEqual(expect.objectContaining({ parentId: null }));
  });

  it('should parse a numeric parentId filter', () => {
    const query = plainToInstance(QueryDestinationDto, {
      filters: JSON.stringify({ parentId: 12 }),
    });

    expect(query.filters).toEqual(expect.objectContaining({ parentId: 12 }));
  });
});
