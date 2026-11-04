import { Workbook } from 'exceljs';

/**
 * The file attached to a no-deposit partner's monthly statement (vande #056).
 *
 * "Chi tiết giao dịch" has one row per order, in the columns anh Thọ set out
 * (vande-0411 #013). It has nothing about marketing partners: a partner on
 * credit does not earn commission. Revenue less refunds adds up to exactly what
 * the email asks them to pay.
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
  /** "Mua eSIM", "Topup" or "Addon". */
  orderKind?: string;
  /** eSIMs bought, or 1 for a topup. */
  quantity?: number;
  /** The eSIMs of the order, or the one topped up, comma separated. */
  iccids?: string;
};

/** One row of the sheet: everything that moved on one order this month. */
export type CreditStatementRow = {
  orderNumber: string;
  products: string;
  quantity: number;
  revenueVnd: number;
  refundVnd: number;
  orderKind: string;
  iccids: string;
  customer: string;
  createdAt: Date;
  status: string;
};

/** Folds the ledger lines of an order into its one row. */
export function creditStatementRows(
  lines: CreditStatementLine[],
): CreditStatementRow[] {
  const rows = new Map<string, CreditStatementRow>();
  for (const line of lines) {
    const row = rows.get(line.orderNumber) ?? {
      orderNumber: line.orderNumber,
      products: line.products,
      quantity: 0,
      revenueVnd: 0,
      refundVnd: 0,
      orderKind: line.orderKind ?? 'Mua eSIM',
      iccids: line.iccids ?? '',
      customer: line.customer,
      createdAt: line.createdAt,
      status: '',
    };
    if (line.amountVnd >= 0) {
      row.revenueVnd += line.amountVnd;
      row.quantity = line.quantity ?? line.esims;
    } else {
      row.refundVnd -= line.amountVnd;
      // Refunded in a later month than it was bought: still say how many.
      row.quantity = row.quantity || (line.quantity ?? line.esims);
    }
    rows.set(line.orderNumber, row);
  }
  for (const row of rows.values()) {
    row.status = !row.refundVnd
      ? 'Đã mua'
      : row.revenueVnd > row.refundVnd
        ? 'Hoàn một phần'
        : 'Đã hoàn tiền';
  }
  return [...rows.values()];
}

/** `Hoàng Hà Mobile` → `Hoang-Ha-Mobile`, for a file name. */
export function fileNamePart(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
    { header: 'Mã đơn hàng', key: 'orderNumber', width: 30 },
    { header: 'Tên sản phẩm', key: 'products', width: 44 },
    { header: 'Số lượng eSIM/gói topup', key: 'quantity', width: 14 },
    { header: 'Doanh thu đơn hàng', key: 'revenueVnd', width: 18 },
    { header: 'Hoàn tiền', key: 'refundVnd', width: 16 },
    { header: 'Loại đơn', key: 'orderKind', width: 12 },
    { header: 'ICCID', key: 'iccids', width: 26 },
    { header: 'Khách hàng', key: 'customer', width: 30 },
    { header: 'Ngày mua hàng', key: 'createdAt', width: 14 },
    { header: 'Trạng thái đơn hàng', key: 'status', width: 18 },
  ];
  const header = sheet.getRow(1);
  header.font = { name: FONT, size: 12, bold: true };
  header.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  header.height = 30;

  const orderRows = creditStatementRows(data.lines);
  orderRows.forEach((row, index) => {
    const added = sheet.addRow({
      ...row,
      stt: index + 1,
      createdAt: vnDate(row.createdAt),
    });
    added.getCell('iccids').alignment = { wrapText: true, vertical: 'top' };
  });
  const total = sheet.addRow({
    orderNumber: 'TỔNG CỘNG',
    quantity: orderRows.reduce((sum, r) => sum + r.quantity, 0),
    revenueVnd: orderRows.reduce((sum, r) => sum + r.revenueVnd, 0),
    refundVnd: orderRows.reduce((sum, r) => sum + r.refundVnd, 0),
  });
  total.font = { name: FONT, size: 12, bold: true };

  for (let r = 2; r <= sheet.rowCount; r++) {
    sheet.getCell(r, 5).numFmt = MONEY_FORMAT;
    sheet.getCell(r, 6).numFmt = MONEY_FORMAT;
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
