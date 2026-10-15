import { vnFold, vnFoldSql } from './vn-fold';

describe('vnFold', () => {
  it('should drop Vietnamese diacritics so "Dung" finds "Dũng" (doitac-1410 #002)', () => {
    expect(vnFold('Hoàng Đình Dũng')).toBe('hoang dinh dung');
    expect(vnFold('Ms.Phượng')).toBe('ms.phuong');
    expect(vnFold('NGUYỄN THỊ HỒNG NHUNG')).toBe('nguyen thi hong nhung');
  });

  it('should leave plain text, digits and emails alone', () => {
    expect(vnFold('vietnamesim@gmail.com')).toBe('vietnamesim@gmail.com');
    expect(vnFold('0921408896')).toBe('0921408896');
  });

  it('should build the matching SQL fold for a column', () => {
    const sql = vnFoldSql('partner.contactName');
    expect(sql.startsWith('translate(lower(partner.contactName), ')).toBe(true);
    // One plain letter for every accented one, or translate() would delete letters.
    const [, from, to] = /'([^']*)', '([^']*)'/.exec(sql)!;
    expect([...from].length).toBe([...to].length);
  });
});
