import { Workbook } from 'exceljs';
import {
  orderImportTemplate,
  parseCsv,
  parseOrderImportFile,
} from './order-import-file';

/** The order file read by "Đặt đơn hộ" and the partner cart (doitac-1410 #084). */
async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('S');
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const opts = { maxRows: 50, withEmail: true };

describe('parseOrderImportFile (doitac-1410 #084)', () => {
  it('should read code, quantity and email by their Vietnamese headers', async () => {
    const buffer = await xlsx([
      ['Mã gói cước', 'Số lượng', 'Email nhận QR'],
      ['jp-5gb-7d', 2, 'Khach@Example.com'],
      [],
      ['th-3gb-5d', '', ''],
    ]);
    const rows = await parseOrderImportFile(buffer, 'don.xlsx', opts);
    expect(rows).toEqual([
      {
        row: 2,
        slug: 'jp-5gb-7d',
        quantity: 2,
        email: 'khach@example.com',
        error: null,
      },
      // Blank quantity means one eSIM; the blank line in between is skipped.
      { row: 4, slug: 'th-3gb-5d', quantity: 1, email: null, error: null },
    ]);
  });

  it('should take the partner price list export as it is (header with other columns)', async () => {
    const buffer = await xlsx([
      ['Mã gói cước', 'Tên gói', 'Điểm đến', 'Số lượng'],
      ['jp-5gb-7d', 'Nhật 5GB', 'Nhật Bản', 3],
    ]);
    const rows = await parseOrderImportFile(buffer, 'bang-gia.xlsx', opts);
    expect(rows).toEqual([
      { row: 2, slug: 'jp-5gb-7d', quantity: 3, email: null, error: null },
    ]);
  });

  it('should flag a bad row without failing the file', async () => {
    const buffer = await xlsx([
      ['Mã gói cước', 'Số lượng', 'Email nhận QR'],
      ['a', 0],
      ['b', 1.5],
      ['', 2],
      ['c', 1, 'not-an-email'],
      ['d', 5000],
    ]);
    const rows = await parseOrderImportFile(buffer, 'don.xlsx', opts);
    expect(rows.map((r) => [r.row, r.error])).toEqual([
      [2, 'Số lượng phải là số nguyên từ 1 trở lên.'],
      [3, 'Số lượng phải là số nguyên từ 1 trở lên.'],
      [4, 'Thiếu mã gói cước.'],
      [5, 'Email không hợp lệ.'],
      [6, 'Số lượng tối đa 1000 mỗi dòng.'],
    ]);
  });

  it('should ignore the email column where the order has no QR email (admin)', async () => {
    const buffer = await xlsx([
      ['Mã gói cước', 'Số lượng', 'Email nhận QR'],
      ['a', 1, 'bad'],
    ]);
    const [row] = await parseOrderImportFile(buffer, 'don.xlsx', {
      maxRows: 20,
      withEmail: false,
    });
    expect(row).toMatchObject({ email: null, error: null });
  });

  it('should refuse more rows than one order takes, rather than split it', async () => {
    const buffer = await xlsx([
      ['Mã gói cước', 'Số lượng'],
      ...Array.from({ length: 21 }, (_, i) => [`p${i}`, 1]),
    ]);
    await expect(
      parseOrderImportFile(buffer, 'don.xlsx', {
        maxRows: 20,
        withEmail: false,
      }),
    ).rejects.toThrow('File có 21 dòng, mỗi lần nhập tối đa 20 dòng');
  });

  it('should refuse a file without the plan code column, an empty one or another type', async () => {
    await expect(
      parseOrderImportFile(
        await xlsx([
          ['A', 'B'],
          [1, 2],
        ]),
        'x.xlsx',
        opts,
      ),
    ).rejects.toThrow('Không thấy cột "Mã gói cước"');
    await expect(
      parseOrderImportFile(await xlsx([['Mã gói cước']]), 'x.xlsx', opts),
    ).rejects.toThrow('File chưa có dòng gói cước nào.');
    await expect(
      parseOrderImportFile(Buffer.from('x'), 'x.pdf', opts),
    ).rejects.toThrow('Chỉ nhận file .xlsx hoặc .csv.');
    await expect(
      parseOrderImportFile(Buffer.from('not a zip'), 'x.xlsx', opts),
    ).rejects.toThrow('Không đọc được file Excel');
  });

  it('should read a CSV saved by Excel (BOM, semicolons, quotes)', async () => {
    const csv =
      '﻿Mã gói cước;Số lượng;Email nhận QR\r\n"jp;5gb";2;a@b.vn\r\nth-3gb;1;\r\n';
    const rows = await parseOrderImportFile(Buffer.from(csv), 'don.csv', opts);
    expect(rows).toEqual([
      { row: 2, slug: 'jp;5gb', quantity: 2, email: 'a@b.vn', error: null },
      { row: 3, slug: 'th-3gb', quantity: 1, email: null, error: null },
    ]);
    expect(parseCsv('a,"b ""c""",d\n1,2,3')).toEqual([
      ['a', 'b "c"', 'd'],
      ['1', '2', '3'],
    ]);
  });

  it('should round-trip its own template', async () => {
    const rows = await parseOrderImportFile(
      await orderImportTemplate(true),
      'mau.xlsx',
      opts,
    );
    expect(rows).toEqual([
      {
        row: 2,
        slug: 'vi-du-ma-goi-cuoc',
        quantity: 2,
        email: 'khach@example.com',
        error: null,
      },
    ]);
  });
});
