import { parseOrderImportFile } from './order-import-file';

/** vande-0411 #010 — the days column of an order file. */
const read = (csv: string) =>
  parseOrderImportFile(Buffer.from(csv, 'utf8'), 'list.csv', {
    maxRows: 50,
    withEmail: true,
  });

describe('File đặt hàng loạt (vande-0411 #010)', () => {
  it('should read the days of a day pass beside the code', async () => {
    const [row] = await read(
      'Mã gói cước,Số ngày,Số lượng,Email nhận QR\nPVG1G9ZU2,14,2,a@gmail.com',
    );
    expect(row).toMatchObject({ slug: 'PVG1G9ZU2', days: 14, quantity: 2 });
    expect(row.error).toBeNull();
  });

  it('should leave the days empty when the file has no such column', async () => {
    const [row] = await read('Mã gói cước,Số lượng\nslug-a,1');
    expect(row.days).toBeNull();
    expect(row.error).toBeNull();
  });

  it.each(['0', '366', '1.5', 'abc'])('should refuse %s days', async (days) => {
    const [row] = await read(`Mã gói cước,Số ngày\nslug-a,${days}`);
    expect(row.error).toContain('Số ngày');
  });
});
