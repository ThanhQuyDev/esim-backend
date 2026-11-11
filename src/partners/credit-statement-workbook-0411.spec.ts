import { Workbook } from 'exceljs';
import {
  buildCreditStatementWorkbook,
  creditStatementRows,
  fileNamePart,
} from './credit-statement-workbook';
import { ESIM_COMPANY } from './company-details';

/**
 * The statement of a distribution partner (vande-0411 #013), on anh Thọ's
 * templates "Mẫu file đối soát_đối tác phân phối" and "Mẫu file Chi tiết
 * giao dịch_đối tác phân phối" (doitac-0911 #009).
 */
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
  onCredit: true,
  balanceAfterVnd: 800_000,
};
const TOPUP = {
  ...BOUGHT,
  orderNumber: 'TOPUP-1',
  products: 'Japan 3GB',
  amountVnd: 50_000,
  esims: 0,
  orderKind: 'Nạp topup',
  quantity: 1,
  iccids: '8901',
  balanceAfterVnd: 750_000,
};

const STATEMENT = {
  partyA: ESIM_COMPANY,
  partyB: {
    name: 'Hoàng Hà Mobile',
    address: '120 Lê Lợi, Quận 1, HCM',
    taxCode: '031234777',
    representative: 'Phạm Hồng Thái',
  },
  contractLines: ['Căn cứ Hợp đồng đại lý số 01/2026'],
  periodStart: new Date(2026, 9, 1),
  periodEnd: new Date(2026, 9, 31),
  issuedAt: new Date(2026, 10, 4),
  vatPercent: 10,
};

async function load(buffer: Buffer): Promise<Workbook> {
  const wb = new Workbook();
  await wb.xlsx.load(buffer as never);
  return wb;
}

function sheetText(wb: Workbook, name: string): string {
  const out: string[] = [];
  wb.getWorksheet(name)!.eachRow((row) =>
    row.eachCell((cell) => out.push(String(cell.value))),
  );
  return out.join('\n');
}

describe('File đối soát đối tác phân phối (vande-0411 #013, doitac-0911 #009)', () => {
  it('should put an order and its refund on one row', () => {
    const [row] = creditStatementRows([
      BOUGHT,
      {
        ...BOUGHT,
        amountVnd: -100_000,
        esims: 0,
        status: 'Hoàn tiền',
        balanceAfterVnd: 900_000,
      },
    ]);

    expect(row).toMatchObject({
      revenueVnd: 200_000,
      refundVnd: 100_000,
      unpaidVnd: 100_000,
      paidVnd: 0,
      balanceAfterVnd: 900_000,
      quantity: 2,
      status: 'Hoàn một phần',
    });
  });

  it('should count a deposit purchase as paid, a credit one as owed', () => {
    const [deposit, credit] = creditStatementRows([
      { ...BOUGHT, onCredit: false },
      { ...TOPUP },
    ]);
    expect(deposit).toMatchObject({ paidVnd: 200_000, unpaidVnd: 0 });
    expect(credit).toMatchObject({ paidVnd: 0, unpaidVnd: 50_000 });
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

  it('should have the columns of the distribution template', async () => {
    const wb = await load(
      await buildCreditStatementWorkbook({
        ...STATEMENT,
        revenueVnd: 250_000,
        amountDueVnd: 250_000,
        lines: [BOUGHT, TOPUP],
      }),
    );
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Đối soát',
      'Chi tiết giao dịch',
    ]);
    const sheet = wb.getWorksheet('Chi tiết giao dịch')!;

    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual([
      'STT',
      'Mã đơn hàng',
      'Loại đơn',
      'Tên sản phẩm',
      'Giá đại lý (VNĐ)',
      'Hoàn tiền (VNĐ)',
      'Đã thanh toán (VNĐ)',
      'Chưa thanh toán (VNĐ)',
      'Số dư / Hạn mức sau',
      'Số lượng eSIM',
      'Trạng thái đơn hàng',
      'Ngày đặt hàng',
    ]);
    // Blue header, white text, as on the template.
    expect(sheet.getCell('A1').fill).toMatchObject({
      fgColor: { argb: 'FF4472C4' },
    });
    expect((sheet.getRow(3).values as unknown[]).slice(1)).toEqual([
      2,
      'TOPUP-1',
      'Nạp topup',
      'Japan 3GB',
      50_000,
      0,
      0,
      50_000,
      750_000,
      1,
      'Đã mua',
      '20/10/2026',
    ]);
    // TỔNG CỘNG: the unpaid total is what the statement asks for.
    expect(sheet.getRow(4).getCell(2).value).toBe('TỔNG CỘNG');
    expect(sheet.getRow(4).getCell(8).value).toBe(250_000);
    expect(sheet.pageSetup.orientation).toBe('landscape');
  });

  it('should be a sales statement with the VAT taken out of the agent price', async () => {
    const wb = await load(
      await buildCreditStatementWorkbook({
        ...STATEMENT,
        revenueVnd: 1_650_000,
        amountDueVnd: 1_100_000,
        lines: [BOUGHT],
      }),
    );
    const text = sheetText(wb, 'Đối soát');

    expect(text).toContain('BIÊN BẢN ĐỐI SOÁT CÔNG NỢ BÁN HÀNG');
    expect(text).toContain(
      'chúng tôi xin gửi Quý đối tác chi tiết phần công nợ tháng 10/2026 (từ ngày 01/10/2026 - 31/10/2026)',
    );
    expect(text).toContain('I. Công nợ bán hàng của Quý đối tác:');
    expect(text).toContain('Công nợ bán hàng tháng 10/2026');
    expect(text).toContain('Bên B phải thanh toán cho Bên A');
    expect(text).not.toContain('hoa hồng');

    const sheet = wb.getWorksheet('Đối soát')!;
    const money: number[] = [];
    let units = 0;
    sheet.eachRow((row) => {
      if (row.getCell(5).value === 'VNĐ') {
        units++;
        money.push(Number(row.getCell(6).value));
      }
    });
    // 1.650.000 with VAT = 1.500.000 + 150.000; "VNĐ" on every line.
    expect(money).toEqual([1_500_000, 1_500_000, 150_000, 1_650_000]);
    expect(units).toBe(4);
    // Section II: what is still unpaid, and in words.
    expect(text).toContain('1100000');
    expect(text).toContain('Bằng chữ: Một triệu một trăm nghìn đồng');
  });

  it('should name the file after the partner', () => {
    expect(fileNamePart('Hoàng Hà Mobile')).toBe('Hoang-Ha-Mobile');
    expect(fileNamePart('Công ty Đại Việt (VN)')).toBe('Cong-ty-Dai-Viet-VN');
    expect(fileNamePart('!!!')).toBe('');
  });
});
