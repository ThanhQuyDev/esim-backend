import { Workbook } from 'exceljs';
import { buildBulkEsimList } from './bulk-esim-list';
import { missingEsimReason } from './orders.service';
import { esimQrPage } from '../esims/esim-qr-page';

/** vande-0411 #011 — a list that says what is missing. */
const ROW = {
  orderNumber: 'ORD-1',
  iccid: '8900',
  planName: 'Japan 5GB',
  destination: 'Nhật',
  planType: 'fixed',
  durationDays: 7,
  dataMb: 5120,
  fupSpeed: null,
  phoneNumber: null,
  call: null,
  sms: null,
  topUp: false,
  packageCode: 'SUPPLIER-CODE',
  slug: 'jp-5gb',
  provider: 'airalo',
  costVnd: 100_000,
  priceVnd: 200_000,
  priceUsd: 8,
  createdBy: 'a@b.vn',
  orderedAt: new Date('2026-11-05T00:00:00Z'),
  activationDeadline: null,
  lpa: 'LPA:1$x$y',
  qrUrl: 'https://x/qr',
};

async function read(rows: unknown[], forAdmin: boolean) {
  const buffer = await buildBulkEsimList(rows as never, { forAdmin });
  const wb = new Workbook();
  await wb.xlsx.load(buffer as never);
  const sheet = wb.worksheets[0];
  const headers = (sheet.getRow(1).values as unknown[]).slice(1) as string[];
  const cell = (row: number, title: string) =>
    sheet.getRow(row).getCell(headers.indexOf(title) + 1).value;
  return { headers, cell, count: sheet.rowCount - 1 };
}

describe('File danh sách eSIM (vande-0411 #011)', () => {
  it('should give a partner the slug as the plan code, with no slug column', async () => {
    const { headers, cell } = await read([ROW], false);

    expect(headers).not.toContain('Slug');
    expect(headers).not.toContain('Nhà cung cấp');
    expect(cell(2, 'Mã gói cước')).toBe('jp-5gb');
  });

  it('should keep both codes for the admin', async () => {
    const { headers, cell } = await read([ROW], true);

    expect(headers).toContain('Slug');
    expect(cell(2, 'Mã gói cước')).toBe('SUPPLIER-CODE');
    expect(cell(2, 'Slug')).toBe('jp-5gb');
  });

  it('should list an eSIM that did not come, saying so', async () => {
    const { cell, count } = await read(
      [
        ROW,
        {
          ...ROW,
          iccid: '',
          lpa: '',
          qrUrl: '',
          missingReason: 'LỖI: nhà cung cấp chưa nhận đơn',
        },
      ],
      false,
    );

    expect(count).toBe(2);
    expect(cell(2, 'Trạng thái eSIM')).toBe('Đã có eSIM');
    expect(cell(3, 'Trạng thái eSIM')).toBe('LỖI: nhà cung cấp chưa nhận đơn');
  });

  it('should tell a refusal from a wait', () => {
    expect(missingEsimReason({ orderRequestId: 'R' })).toContain('đang cấp');
    expect(missingEsimReason({ lastProvisionError: 'x' })).toContain('LỖI');
    expect(missingEsimReason({})).toBe('Chưa có eSIM');
  });

  it('should show what identifies the eSIM and escape it', () => {
    const page = esimQrPage({
      imageUrl: '/qr?token=a&b=1',
      iccid: '8900',
      planName: '<script>alert(1)</script>',
      orderNumber: 'ORD-1',
    });

    expect(page).toContain('8900');
    expect(page).toContain('ORD-1');
    expect(page).toContain('&lt;script&gt;');
    expect(page).not.toContain('<script>alert');
    expect(page).toContain('/qr?token=a&amp;b=1');
  });
});
