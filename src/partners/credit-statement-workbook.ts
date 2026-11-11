import { Workbook } from 'exceljs';
import {
  buildStatementSheet,
  printReady,
  StatementSheetData,
  wrappedRowHeight,
} from './reconciliation-workbook';

/**
 * The file attached to a distribution partner's monthly statement (vande #056,
 * doitac-0911 #009), built on anh Thọ's two templates "Mẫu file đối soát_đối
 * tác phân phối" and "Mẫu file Chi tiết giao dịch_đối tác phân phối":
 *
 * - "Đối soát": the sales statement both sides sign — the month's sales
 *   (agent prices include VAT 10%, so line 1 is before tax) and what the
 *   partner still has to pay;
 * - "Chi tiết giao dịch": one row per order. Paid and unpaid add up to the
 *   sales, and the unpaid total is the statement's amount to pay.
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
  /** "Mua eSIM", "Nạp topup" or "Addon". */
  orderKind?: string;
  /** eSIMs bought, or 1 for a topup. */
  quantity?: number;
  /** The eSIMs of the order, or the one topped up, comma separated. */
  iccids?: string;
  /**
   * Bought on the credit limit (owed) rather than from a deposit (already
   * paid). A line without it is on credit, as every line was before #009.
   */
  onCredit?: boolean;
  /** The wallet — deposit or remaining limit — right after this line. */
  balanceAfterVnd?: number;
  /** When the order was placed; the line's own time when not given. */
  orderedAt?: Date;
};

/** One row of the sheet: everything that moved on one order this month. */
export type CreditStatementRow = {
  orderNumber: string;
  products: string;
  quantity: number;
  revenueVnd: number;
  refundVnd: number;
  /** Out of a deposit: paid when bought (doitac-0911 #009). */
  paidVnd: number;
  /** On the credit limit: still owed. */
  unpaidVnd: number;
  /** "Số dư / Hạn mức sau": the wallet after the order's last line. */
  balanceAfterVnd: number | null;
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
      paidVnd: 0,
      unpaidVnd: 0,
      balanceAfterVnd: null,
      orderKind: line.orderKind ?? 'Mua eSIM',
      iccids: line.iccids ?? '',
      customer: line.customer,
      createdAt: line.orderedAt ?? line.createdAt,
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
    // A refund goes back the way the money came: off the debt, or into
    // the deposit.
    if (line.onCredit === false) row.paidVnd += line.amountVnd;
    else row.unpaidVnd += line.amountVnd;
    if (line.balanceAfterVnd != null)
      row.balanceAfterVnd = line.balanceAfterVnd;
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

export type CreditStatementData = Omit<
  StatementSheetData,
  'kind' | 'totalVnd' | 'payableVnd'
> & {
  /** Sales less refunds, VAT included: section I of the statement. */
  revenueVnd: number;
  /** Still to pay: section II. */
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

/** The columns of "Mẫu file Chi tiết giao dịch_đối tác phân phối". */
const COLUMNS = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'Mã đơn hàng', key: 'orderNumber', width: 31 },
  { header: 'Loại đơn', key: 'orderKind', width: 13 },
  { header: 'Tên sản phẩm', key: 'products', width: 44 },
  { header: 'Giá đại lý (VNĐ)', key: 'revenueVnd', width: 16 },
  { header: 'Hoàn tiền (VNĐ)', key: 'refundVnd', width: 15 },
  { header: 'Đã thanh toán (VNĐ)', key: 'paidVnd', width: 16 },
  { header: 'Chưa thanh toán (VNĐ)', key: 'unpaidVnd', width: 17 },
  { header: 'Số dư / Hạn mức sau', key: 'balanceAfterVnd', width: 18 },
  { header: 'Số lượng eSIM', key: 'quantity', width: 11 },
  { header: 'Trạng thái đơn hàng', key: 'status', width: 16 },
  { header: 'Ngày đặt hàng', key: 'createdAt', width: 13 },
];
const MONEY_KEYS = [
  'revenueVnd',
  'refundVnd',
  'paidVnd',
  'unpaidVnd',
  'balanceAfterVnd',
];

export async function buildCreditStatementWorkbook(
  data: CreditStatementData,
): Promise<Buffer> {
  const wb = new Workbook();
  wb.creator = data.partyA.name;
  wb.created = data.issuedAt;

  // Sheet 1: the statement to print and sign (doitac-0911 #009, #010).
  buildStatementSheet(wb.addWorksheet('Đối soát'), {
    ...data,
    kind: 'sales',
    totalVnd: data.revenueVnd,
    payableVnd: data.amountDueVnd,
  });

  const sheet = wb.addWorksheet('Chi tiết giao dịch');
  sheet.columns = COLUMNS;
  const lastCol = COLUMNS.length;
  // Nền xanh dương, chữ trắng (doitac-0911 #010).
  const header = sheet.getRow(1);
  header.font = {
    name: FONT,
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  for (let c = 1; c <= lastCol; c++) {
    header.getCell(c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
  }
  header.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  header.height = 30;

  const orderRows = creditStatementRows(data.lines);
  orderRows.forEach((row, index) => {
    sheet.addRow({
      stt: index + 1,
      orderNumber: row.orderNumber,
      orderKind: row.orderKind,
      products: row.products,
      revenueVnd: row.revenueVnd,
      refundVnd: row.refundVnd,
      paidVnd: row.paidVnd,
      unpaidVnd: row.unpaidVnd,
      balanceAfterVnd: row.balanceAfterVnd ?? '',
      quantity: row.quantity,
      status: row.status,
      createdAt: vnDate(row.createdAt),
    });
  });
  const sum = (key: 'revenueVnd' | 'refundVnd' | 'paidVnd' | 'unpaidVnd') =>
    orderRows.reduce((total, r) => total + r[key], 0);
  const total = sheet.addRow({
    orderNumber: 'TỔNG CỘNG',
    revenueVnd: sum('revenueVnd'),
    refundVnd: sum('refundVnd'),
    paidVnd: sum('paidVnd'),
    unpaidVnd: sum('unpaidVnd'),
    quantity: orderRows.reduce((n, r) => n + r.quantity, 0),
  });

  for (let r = 2; r <= sheet.rowCount; r++) {
    const line = sheet.getRow(r);
    line.font = { name: FONT, size: 11 };
    line.alignment = { vertical: 'middle' };
    for (const key of MONEY_KEYS) line.getCell(key).numFmt = MONEY_FORMAT;
    // A long product list wraps instead of being cut off when printed.
    line.getCell('products').alignment = { vertical: 'middle', wrapText: true };
    line.height = wrappedRowHeight(
      String(line.getCell('products').value ?? ''),
      44,
    );
  }
  total.font = { name: FONT, size: 11, bold: true };

  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= lastCol; c++) {
      sheet.getCell(r, c).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  printReady(sheet, 'L', { repeatHeader: true });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
