import * as ExcelJS from 'exceljs';
import { PartnersService } from './partners.service';

/**
 * The partner's orders as a spreadsheet (#027).
 *
 * Built on top of the same read model as the screen rather than its own query,
 * so the file cannot quietly disagree with the list — revenue net of refunds,
 * commission net of reversals, top-ups excluded.
 */

function buildService(orders: unknown[]) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    getMyOrders: jest.fn().mockResolvedValue(orders),
  });
  return service;
}

async function readSheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const rows: unknown[][] = [];
  sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
  return rows;
}

describe('PartnersService — exporting the order list (#027)', () => {
  it('should write the columns the brief asks for', async () => {
    const rows = await readSheet(
      await buildService([]).exportMyOrdersToExcel(5),
    );

    expect(rows[0]).toEqual([
      'Mã đơn hàng',
      'Tên sản phẩm',
      'Giá trị doanh thu (VND)',
      'Nguồn ghi nhận',
      'Khách hàng',
      'Số lượng eSIM',
      'Mức % hoa hồng',
      'Tiền hoa hồng (VND)',
      'Trạng thái',
      'Ngày đặt hàng',
    ]);
  });

  it('should spell out the source, the customer and the status', async () => {
    const service = buildService([
      {
        orderNumber: 'ORD-1',
        items: [
          { planName: 'Nhật Bản 5GB', quantity: 2, refunded: false },
          { planName: 'Hàn Quốc 3GB', quantity: 1, refunded: true },
        ],
        vndPrice: 1_200_000,
        linkCode: 'VANA2026',
        couponCode: null,
        customerType: 'new',
        esimCount: 3,
        commissionPercent: 15,
        commissionVnd: 180_000,
        commissionStatus: 'credited',
        createdAt: new Date('2026-09-20T03:00:00Z'),
      },
    ]);

    const rows = await readSheet(await service.exportMyOrdersToExcel(5));

    expect(rows[1][0]).toBe('ORD-1');
    // A refunded product is named as such rather than silently dropped.
    expect(rows[1][1]).toBe('Nhật Bản 5GB x2 + Hàn Quốc 3GB (đã hoàn)');
    expect(rows[1][3]).toBe('Link: /go/VANA2026');
    expect(rows[1][4]).toBe('Khách mới');
    expect(rows[1][8]).toBe('Đã duyệt');
  });

  it('should name the discount code when the order came in on one', async () => {
    const service = buildService([
      {
        orderNumber: 'ORD-2',
        items: [],
        vndPrice: 500_000,
        linkCode: null,
        couponCode: 'VANA10',
        customerType: 'returning',
        esimCount: 1,
        commissionPercent: null,
        commissionVnd: 0,
        commissionStatus: 'pending',
        createdAt: new Date('2026-09-21T03:00:00Z'),
      },
    ]);

    const rows = await readSheet(await service.exportMyOrdersToExcel(5));

    expect(rows[1][3]).toBe('Mã: VANA10');
    expect(rows[1][4]).toBe('Khách quay lại');
    expect(rows[1][8]).toBe('Chờ xác nhận');
  });
});
