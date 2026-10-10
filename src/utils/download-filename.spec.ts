import { downloadFilename, downloadStamp } from './download-filename';

/** #055 (test round 4) — export files named by when they were downloaded. */
describe('downloadFilename (#055)', () => {
  // 00:41:52 on 06/10/2026 in Vietnam = 17:41:52 UTC on 05/10.
  const at = new Date('2026-10-05T17:41:52.000Z');

  it('should stamp Vietnam time as dd-MM-yyyy_HH-mm-ss', () => {
    expect(downloadStamp(at)).toBe('06-10-2026_00-41-52');
  });

  it("should match the tester's example", () => {
    expect(downloadFilename('Danh-sach-link-tiep-thi', 'xlsx', at)).toBe(
      'Danh-sach-link-tiep-thi_06-10-2026_00-41-52.xlsx',
    );
  });
});
