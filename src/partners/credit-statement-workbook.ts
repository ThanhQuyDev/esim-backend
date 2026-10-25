import { Workbook } from 'exceljs';

/**
 * The file attached to a no-deposit partner's monthly statement (vande #056).
 *
 * "Chi tiết giao dịch" keeps the columns of the sheet "Mẫu file Chi tiết giao
 * dịch" in the source Excel, so the partner reads the same layout as the
 * commission statement; the two commission columns stay empty, since a
 * partner buying stock earns none. A refund is its own line with a negative
 * amount, so the column adds up to exactly what the email asks them to pay.
 */

export type CreditStatementLine = {
  orderNumber: string;
  products: string;
  /** Paid at the agent price; negative for money given back. */
  amountVnd: number;
  /** Where the eSIMs were sent. */
  customer: string;
  esims: number;
  /** "Đã mua" or "Hoàn tiền". */
  status: string;
  createdAt: Date;
};

export type CreditStatementData = {
  partnerName: string;
  /** "Tháng 10/2026". */
  periodLabel: string;
  creditLimitVnd: number;
  purchasedVnd: number;
  refundedVnd: number;
  amountDueVnd: number;
  lines: CreditStatementLine[];
};

const MONEY_FORMAT = '#,##0';
const FONT = 'Times New Roman';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** dd/mm/yyyy in Vietnam, whatever clock the server runs on. */
function vnDate(date: Date): string {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  const d = String(vn.getUTCDate()).padStart(2, '0');
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${vn.getUTCFullYear()}`;
}

export async function buildCreditStatementWorkbook(
  data: CreditStatementData,
): Promise<Buffer> {
  const wb = new Workbook();

  const summary = wb.addWorksheet('Tổng hợp');
  summary.columns = [
    { key: 'label', width: 38 },
    { key: 'value', width: 24 },
  ];
  const title = summary.addRow([
    `ĐỐI SOÁT TIỀN HÀNG ${data.periodLabel.toUpperCase()}`,
  ]);
  title.font = { name: FONT, size: 14, bold: true };
  summary.addRow([`Đối tác: ${data.partnerName}`]).font = {
    name: FONT,
    size: 12,
  };
  summary.addRow([]);
  const rows: [string, number][] = [
    ['Hạn mức giao dịch / tháng', data.creditLimitVnd],
    ['Tiền hàng đã mua', data.purchasedVnd],
    ['Đã hoàn lại (đơn huỷ / eSIM lỗi)', data.refundedVnd],
    ['Số tiền cần thanh toán', data.amountDueVnd],
  ];
  for (const [label, value] of rows) {
    const row = summary.addRow({ label, value });
    row.font = { name: FONT, size: 12 };
    row.getCell(2).numFmt = MONEY_FORMAT;
  }
  summary.lastRow!.font = { name: FONT, size: 12, bold: true };

  const sheet = wb.addWorksheet('Chi tiết giao dịch');
  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Mã đơn hàng', key: 'orderNumber', width: 28 },
    { header: 'Tên sản phẩm', key: 'products', width: 40 },
    { header: 'Doanh thu đơn hàng', key: 'amountVnd', width: 20 },
    { header: 'Nguồn ghi nhận', key: 'source', width: 22 },
    { header: 'Khách hàng', key: 'customer', width: 28 },
    { header: 'Số lượng eSIM', key: 'esims', width: 14 },
    { header: 'Mức % hoa hồng', key: 'commissionPercent', width: 16 },
    { header: 'Tiền hoa hồng', key: 'commissionVnd', width: 18 },
    { header: 'Trạng thái đơn hàng', key: 'status', width: 20 },
    { header: 'Ngày đặt hàng', key: 'createdAt', width: 14 },
  ];
  const header = sheet.getRow(1);
  header.font = { name: FONT, size: 12, bold: true };
  header.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  header.height = 30;

  data.lines.forEach((line, index) => {
    sheet.addRow({
      stt: index + 1,
      orderNumber: line.orderNumber,
      products: line.products,
      amountVnd: line.amountVnd,
      source: 'Mua bằng hạn mức',
      customer: line.customer,
      esims: line.esims,
      status: line.status,
      createdAt: vnDate(line.createdAt),
    });
  });
  const total = sheet.addRow({
    orderNumber: 'TỔNG CỘNG',
    amountVnd: data.lines.reduce((sum, l) => sum + l.amountVnd, 0),
    esims: data.lines.reduce((sum, l) => sum + l.esims, 0),
  });
  total.font = { name: FONT, size: 12, bold: true };

  for (let r = 2; r <= sheet.rowCount; r++) {
    sheet.getCell(r, 4).numFmt = MONEY_FORMAT;
  }
  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= 11; c++) {
      sheet.getCell(r, c).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}
