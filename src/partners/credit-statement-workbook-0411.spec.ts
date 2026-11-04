import { Workbook } from 'exceljs';
import {
  buildCreditStatementWorkbook,
  creditStatementRows,
  fileNamePart,
} from './credit-statement-workbook';

/** vande-0411 #013 — the statement of a partner on credit. */
const AT = new Date('2026-10-20T03:00:00Z');
const BOUGHT = {
  orderNumber: 'PTN-1',
  products: 'Japan 5GB x2',
  amountVnd: 200_000,
  customer: 'khach@gmail.com',
  esims: 2,
  status: 'Đã mua',
  createdAt: AT,
  orderKind: 'Mua eSIM',
  quantity: 2,
  iccids: '8901, 8902',
};
const TOPUP = {
  ...BOUGHT,
  orderNumber: 'TOPUP-1',
  products: 'Japan 3GB',
  amountVnd: 50_000,
  esims: 0,
  orderKind: 'Topup',
  quantity: 1,
  iccids: '8901',
};

describe('File đối soát đối tác không ký quỹ (vande-0411 #013)', () => {
  it('should put an order and its refund on one row', () => {
    const [row] = creditStatementRows([
      BOUGHT,
      { ...BOUGHT, amountVnd: -100_000, esims: 0, status: 'Hoàn tiền' },
    ]);

    expect(row).toMatchObject({
      revenueVnd: 200_000,
      refundVnd: 100_000,
      quantity: 2,
      status: 'Hoàn một phần',
    });
  });

  it('should show a refund from an earlier month, with its quantity', () => {
    const [row] = creditStatementRows([
      { ...BOUGHT, amountVnd: -200_000, esims: 0, status: 'Hoàn tiền' },
    ]);

    expect(row).toMatchObject({
      revenueVnd: 0,
      refundVnd: 200_000,
      quantity: 2,
      status: 'Đã hoàn tiền',
    });
  });

  it('should have the columns asked for and nothing about commission', async () => {
    const buffer = await buildCreditStatementWorkbook({
      partnerName: 'Hoàng Hà Mobile',
      periodLabel: 'Tháng 10/2026',
      creditLimitVnd: 1_000_000,
      purchasedVnd: 250_000,
      refundedVnd: 0,
      amountDueVnd: 250_000,
      lines: [BOUGHT, TOPUP],
    });
    const wb = new Workbook();
    await wb.xlsx.load(buffer as never);
    const sheet = wb.getWorksheet('Chi tiết giao dịch')!;

    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual([
      'STT',
      'Mã đơn hàng',
      'Tên sản phẩm',
      'Số lượng eSIM/gói topup',
      'Doanh thu đơn hàng',
      'Hoàn tiền',
      'Loại đơn',
      'ICCID',
      'Khách hàng',
      'Ngày mua hàng',
      'Trạng thái đơn hàng',
    ]);
    expect((sheet.getRow(3).values as unknown[]).slice(1)).toEqual([
      2,
      'TOPUP-1',
      'Japan 3GB',
      1,
      50_000,
      0,
      'Topup',
      '8901',
      'khach@gmail.com',
      '20/10/2026',
      'Đã mua',
    ]);
    expect(sheet.getRow(4).getCell(5).value).toBe(250_000);
  });

  it('should name the file after the partner', () => {
    expect(fileNamePart('Hoàng Hà Mobile')).toBe('Hoang-Ha-Mobile');
    expect(fileNamePart('Công ty Đại Việt (VN)')).toBe('Cong-ty-Dai-Viet-VN');
    expect(fileNamePart('!!!')).toBe('');
  });
});
