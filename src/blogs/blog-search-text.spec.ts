import {
  plainLikePattern,
  plainSearchText,
  plainSqlText,
} from './blog-search-text';

/** vande-2011 #044: "Trung Quốc" found nothing though posts said "Trung quốc". */
describe('blog search text', () => {
  it('should read any case and any marks the same', () => {
    for (const q of [
      'Trung Quốc',
      'trung quốc',
      'TRUNG QUỐC',
      'Trung quoc',
      '  Trung   Quốc ',
    ]) {
      expect(plainSearchText(q)).toBe('trung quoc');
    }
    expect(plainSearchText('Đà Nẵng')).toBe('da nang');
  });

  it('should take % and _ literally', () => {
    expect(plainLikePattern('50%_off')).toBe(String.raw`%50\%\_off%`);
  });

  it('should fold the column the same way in SQL', () => {
    const sql = plainSqlText('blog.title');
    expect(sql).toMatch(/^translate\(lower\(blog\.title\), '.+', '.+'\)$/);
  });
});
