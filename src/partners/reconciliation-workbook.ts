import { Workbook, Worksheet } from 'exceljs';
import { vndInWords } from './vnd-in-words';

/**
 * File Excel đính kèm email đối soát hằng tháng (#006).
 *
 * Hai sheet, theo đúng mô tả: "Đối soát" là biên bản hai bên ký — dựng theo file
 * mẫu `mau-doi-soat.xlsx` anh gửi 02/10/2026 — và "Chi tiết giao dịch" là bảng kê
 * từng đơn trong kỳ.
 *
 * Phần cố định (Bên A, các dòng "Căn cứ…", câu kết) lấy từ hằng số và từ hồ sơ
 * đối tác; phần thay đổi theo tháng (kỳ, số tiền, ngày lập) do hệ thống điền —
 * đúng chỗ chữ màu đỏ trong file mẫu.
 */

/** Một bên trong biên bản. */
export type ReconciliationParty = {
  name: string;
  address: string;
  taxCode: string;
  /** Người đại diện, đã kèm "Ông"/"Bà" nếu có. */
  representative: string;
  /** Chức vụ; để trống thì dòng vẫn in ra nhưng bỏ trống, như file mẫu. */
  position?: string;
};

/**
 * Một dòng của sheet "Chi tiết giao dịch" — đúng bộ cột trong sheet mẫu
 * "Mẫu file Chi tiết giao dịch" (file tài liệu 02/10/2026).
 */
export type ReconciliationTransaction = {
  orderNumber: string;
  /** Tên các gói trong đơn, đã ghép sẵn. */
  products: string;
  revenueVnd: number;
  /** "Link - EOKIC5TO" hoặc "Mã - ESIMAF". */
  source: string;
  /** "Khách mới" hoặc "Khách quay lại". */
  customer: string;
  esims: number;
  /** Mức % hoa hồng tại thời điểm ghi nhận; null khi không phát sinh. */
  commissionPercent: number | null;
  commissionVnd: number;
  /** Trạng thái hoa hồng đã dịch: "Đã duyệt" / "Chờ xác nhận" / "Hoàn tiền". */
  status: string;
  createdAt: Date;
};

export type ReconciliationWorkbookData = {
  /** PNG of the esim.vn icon for the top left corner (doitac-0911 #007). */
  logo?: Buffer | null;
  partyA: ReconciliationParty;
  partyB: ReconciliationParty;
  /** Ngày đầu và ngày cuối của kỳ đối soát. */
  periodStart: Date;
  periodEnd: Date;
  /** Ngày lập biên bản — "Hôm nay ngày …". */
  issuedAt: Date;
  /** Các dòng "Căn cứ…", lấy từ `partner.contractInfo`. */
  contractLines: string[];
  /**
   * Hoa hồng của kỳ, ĐÃ GỒM VAT: đúng số hệ thống trả vào ví đối tác
   * (doitac-0911 #004). Biên bản tách ra phần trước thuế và tiền thuế.
   */
  commissionVnd: number;
  /** Thuế suất VAT, phần trăm. */
  vatPercent: number;
  transactions: ReconciliationTransaction[];
};

/**
 * Which statement the "Đối soát" sheet is (doitac-0911 #009):
 * - `commission`: esim.vn pays a marketing partner their commission;
 * - `sales`: a distribution partner pays esim.vn for what they bought — the
 *   template's yellow cells: its title, opening sentence, section I, the unit
 *   on every line, and Bên B paying Bên A.
 */
export type StatementKind = 'commission' | 'sales';

export type StatementSheetData = Omit<
  ReconciliationWorkbookData,
  'transactions' | 'commissionVnd'
> & {
  kind: StatementKind;
  /** Section I's total, VAT included. */
  totalVnd: number;
  /** Section II's amount; the total when not given. */
  payableVnd?: number;
};

const MONEY_FORMAT = '#,##0';
const FONT = 'Times New Roman';

function ddmmyyyy(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function mmyyyy(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

/** Chiều rộng A..F của biên bản, theo đơn vị cột Excel. */
const STATEMENT_WIDTH = 9 + 26 + 14 + 16 + 14 + 20;

/**
 * Chiều cao đủ cho `text` trong một ô gộp rộng `width` (doitac-0911 #010).
 * Excel không tự giãn dòng của ô gộp, nên dòng dài 2–3 hàng chữ chỉ hiện một
 * hàng và in ra bị mất chữ. Ước lượng theo số ký tự mỗi hàng ở cỡ chữ đó.
 */
export function wrappedRowHeight(
  text: string,
  width: number,
  size = 11,
): number {
  const perLine = Math.max(1, Math.floor((width * 11) / size) * 1.1);
  const lines = String(text)
    .split(/\r?\n/)
    .reduce(
      (sum, part) => sum + Math.max(1, Math.ceil(part.length / perLine)),
      0,
    );
  return Math.max(15, Math.ceil(lines * size * 1.35 + 2));
}

/**
 * In ngay được, không phải căn chỉnh (doitac-0911 #010): A4 khổ ngang, vừa
 * một trang chiều ngang, căn giữa, lề hẹp.
 */
export function printReady(
  sheet: Worksheet,
  lastCol: string,
  opts: { onePage?: boolean; repeatHeader?: boolean } = {},
): void {
  sheet.pageSetup = {
    ...sheet.pageSetup,
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: opts.onePage ? 1 : 0,
    horizontalCentered: true,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
    printArea: `A1:${lastCol}${sheet.rowCount}`,
    ...(opts.repeatHeader ? { printTitlesRow: '1:1' } : {}),
  };
}

/** Ghi một dòng chữ chiếm hết chiều ngang biên bản (A..F). */
function fullWidthRow(
  sheet: Worksheet,
  rowNumber: number,
  text: string,
  opts: {
    bold?: boolean;
    center?: boolean;
    italic?: boolean;
    size?: number;
  } = {},
): void {
  sheet.mergeCells(rowNumber, 1, rowNumber, 6);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = text;
  // Cỡ 11 như file mẫu (doitac-0911 #010).
  const size = opts.size ?? 11;
  cell.font = {
    name: FONT,
    size,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
  };
  cell.alignment = {
    horizontal: opts.center ? 'center' : 'left',
    vertical: 'middle',
    wrapText: true,
  };
  sheet.getRow(rowNumber).height = wrappedRowHeight(
    text,
    STATEMENT_WIDTH,
    size,
  );
}

/** The "Đối soát" sheet, two parties' signed statement (#006, doitac-0911 #009). */
export function buildStatementSheet(
  sheet: Worksheet,
  data: StatementSheetData,
): void {
  const sales = data.kind === 'sales';
  sheet.columns = [
    // Wide enough for the logo in A1 (doitac-0911 #007). Sum: STATEMENT_WIDTH.
    { width: 9 },
    { width: 26 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 20 },
  ];

  // ── Tiêu ngữ ──────────────────────────────────────────────────────────
  sheet.mergeCells('B1:C1');
  const letterhead = sheet.getCell('B1');
  letterhead.value = data.partyA.name.toUpperCase();
  letterhead.font = { name: FONT, size: 12, bold: true };
  letterhead.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };

  sheet.mergeCells('D1:F1');
  const motto = sheet.getCell('D1');
  motto.value =
    'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc';
  motto.font = { name: FONT, size: 11, bold: true };
  motto.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  sheet.getRow(1).height = 36;

  // The esim.vn mark at the top left, where the template has it
  // (doitac-0911 #007): 197×126 kept in proportion, inside A1.
  if (data.logo?.length) {
    const imageId = sheet.workbook.addImage({
      buffer: data.logo as never,
      extension: 'png',
    });
    sheet.addImage(imageId, {
      tl: { col: 0.08, row: 0.1 },
      ext: { width: 59, height: 38 },
      editAs: 'oneCell',
    });
  }

  sheet.mergeCells('E3:F3');
  const issued = sheet.getCell('E3');
  issued.value = `Ngày ${ddmmyyyy(data.issuedAt)}`;
  issued.font = { name: FONT, size: 12, italic: true };
  issued.alignment = { horizontal: 'center' };

  // Một dòng trống giữa ngày lập và tiêu đề (doitac-0911 #010).
  fullWidthRow(
    sheet,
    5,
    sales
      ? 'BIÊN BẢN ĐỐI SOÁT CÔNG NỢ BÁN HÀNG'
      : 'BIÊN BẢN ĐỐI SOÁT DOANH THU, HOA HỒNG',
    {
      bold: true,
      center: true,
      size: 14,
    },
  );
  fullWidthRow(
    sheet,
    6,
    `Từ ngày ${ddmmyyyy(data.periodStart)} đến ngày ${ddmmyyyy(data.periodEnd)}`,
    { center: true, bold: true },
  );

  // ── Hai bên ───────────────────────────────────────────────────────────
  let row = 8;
  const party = (label: string, p: ReconciliationParty) => {
    fullWidthRow(sheet, row++, `${label}: ${p.name}`, { bold: true });
    fullWidthRow(sheet, row++, `Địa chỉ: ${p.address}`);
    fullWidthRow(sheet, row++, `MST: ${p.taxCode}`);

    // Đại diện và chức vụ nằm cùng một dòng, như file mẫu.
    sheet.mergeCells(row, 1, row, 3);
    sheet.mergeCells(row, 4, row, 6);
    const rep = sheet.getCell(row, 1);
    rep.value = `Đại diện: ${p.representative}`;
    rep.font = { name: FONT, size: 11, bold: true };
    const pos = sheet.getCell(row, 4);
    pos.value = `Chức vụ: ${p.position ?? ''}`;
    pos.font = { name: FONT, size: 11, bold: true };
    row += 2;
  };

  party('Bên A', data.partyA);
  party('Bên B', data.partyB);

  // ── Căn cứ ────────────────────────────────────────────────────────────
  for (const line of data.contractLines) {
    fullWidthRow(sheet, row++, line, { italic: true });
  }
  row++;

  fullWidthRow(
    sheet,
    row++,
    sales
      ? `Hôm nay ngày ${ddmmyyyy(data.issuedAt)}, chúng tôi xin gửi Quý đối tác chi tiết phần công nợ tháng ${mmyyyy(
          data.periodStart,
        )} (từ ngày ${ddmmyyyy(data.periodStart)} - ${ddmmyyyy(
          data.periodEnd,
        )}) theo kết quả kinh doanh của Quý đối tác. Chi tiết về công nợ Quý đối tác ghi nhận trong tháng như sau:`
      : `Hôm nay ngày ${ddmmyyyy(data.issuedAt)}, hai bên cùng đối chiếu và xác nhận như sau:`,
  );
  row++;

  // ── I. Chia sẻ doanh thu / Công nợ bán hàng ───────────────────────────
  fullWidthRow(
    sheet,
    row++,
    sales
      ? 'I. Công nợ bán hàng của Quý đối tác:'
      : 'I. Chia sẻ doanh thu cho đối tác đạt:',
    { bold: true },
  );

  const headerRow = row;
  sheet.mergeCells(row, 2, row, 4);
  const headers: [number, string][] = [
    [1, 'STT'],
    [2, 'Nội dung thanh toán'],
    [5, 'Đơn vị tính'],
    [6, 'Số tiền thanh toán'],
  ];
  for (const [col, text] of headers) {
    const cell = sheet.getCell(row, col);
    cell.value = text;
    cell.font = { name: FONT, size: 12, bold: true };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
  }
  row++;

  // The commission already includes VAT (doitac-0911 #004), and so does the
  // agent price a distribution partner pays (#009): before tax is the total
  // divided by 1 + VAT.
  const total = Math.round(data.totalVnd);
  const beforeVat = Math.round((total * 100) / (100 + data.vatPercent));
  const vat = total - beforeVat;

  const moneyRows: [string, string, number][] = [
    [
      '1',
      sales
        ? `Công nợ bán hàng tháng ${mmyyyy(data.periodStart)}`
        : `Chia sẻ doanh thu bán hàng tháng ${mmyyyy(data.periodStart)}`,
      beforeVat,
    ],
    ['2', 'Tổng số tiền trước thuế VAT', beforeVat],
    ['3', `Thuế VAT (${data.vatPercent}%)`, vat],
    ['4', 'Tổng số tiền (gồm VAT)', total],
  ];

  for (const [stt, label, amount] of moneyRows) {
    sheet.mergeCells(row, 2, row, 4);
    sheet.getCell(row, 1).value = stt;
    sheet.getCell(row, 1).alignment = { horizontal: 'center' };
    sheet.getCell(row, 2).value = label;
    // Chỉ dòng đầu ghi đơn vị, như file mẫu; mẫu phân phối ghi mọi dòng.
    if (stt === '1' || sales) sheet.getCell(row, 5).value = 'VNĐ';
    sheet.getCell(row, 5).alignment = { horizontal: 'center' };
    const money = sheet.getCell(row, 6);
    money.value = amount;
    money.numFmt = MONEY_FORMAT;
    money.alignment = { horizontal: 'right' };
    for (let col = 1; col <= 6; col++) {
      sheet.getCell(row, col).font = { name: FONT, size: 12 };
    }
    row++;
  }

  // Viền cho cả bảng, kể cả dòng tiêu đề.
  for (let r = headerRow; r < row; r++) {
    for (let c = 1; c <= 6; c++) {
      sheet.getCell(r, c).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }

  sheet.mergeCells(row, 2, row, 6);
  const inWords = sheet.getCell(row, 2);
  inWords.value = `Bằng chữ: ${vndInWords(total)}`;
  inWords.font = { name: FONT, size: 12, italic: true };
  row += 2;

  // ── II. Thanh toán ────────────────────────────────────────────────────
  fullWidthRow(sheet, row++, 'II. Thanh toán', { bold: true });

  // A distribution partner owes what they have not paid yet (#009): bought
  // from a deposit is already paid.
  const payableVnd = Math.round(data.payableVnd ?? total);
  sheet.mergeCells(row, 1, row, 5);
  const payableLabel = sheet.getCell(row, 1);
  payableLabel.value = `Tổng số tiền ${
    sales
      ? 'Bên B phải thanh toán cho Bên A'
      : 'Bên A phải thanh toán cho Bên B'
  } (đã bao gồm thuế) tính đến ngày ${ddmmyyyy(data.periodEnd)} là:`;
  payableLabel.font = { name: FONT, size: 11 };
  payableLabel.alignment = { wrapText: true, vertical: 'middle' };
  sheet.getRow(row).height = wrappedRowHeight(
    String(payableLabel.value),
    STATEMENT_WIDTH - 20,
  );
  const payable = sheet.getCell(row, 6);
  payable.value = payableVnd;
  payable.numFmt = MONEY_FORMAT;
  payable.font = { name: FONT, size: 11, bold: true };
  payable.alignment = { horizontal: 'right', vertical: 'middle' };
  row++;

  fullWidthRow(sheet, row++, `Bằng chữ: ${vndInWords(payableVnd)}`, {
    italic: true,
  });
  row++;

  fullWidthRow(
    sheet,
    row++,
    'Biên bản này được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 1 bản, làm cơ sở cho việc thanh quyết toán sau đối chiếu công nợ',
  );
  row += 2;

  // ── Chữ ký ────────────────────────────────────────────────────────────
  sheet.mergeCells(row, 1, row, 3);
  sheet.mergeCells(row, 4, row, 6);
  for (const [col, text] of [
    [1, 'ĐẠI DIỆN BÊN A'],
    [4, 'ĐẠI DIỆN BÊN B'],
  ] as [number, string][]) {
    const cell = sheet.getCell(row, col);
    cell.value = text;
    cell.font = { name: FONT, size: 11, bold: true };
    cell.alignment = { horizontal: 'center' };
  }
  const signatureRow = row + 6;
  sheet.mergeCells(signatureRow, 1, signatureRow, 3);
  sheet.mergeCells(signatureRow, 4, signatureRow, 6);
  for (const [col, text] of [
    [1, data.partyA.representative.replace(/^(Ông|Bà)\s+/i, '').toUpperCase()],
    [4, data.partyB.representative.replace(/^(Ông|Bà)\s+/i, '').toUpperCase()],
  ] as [number, string][]) {
    const cell = sheet.getCell(signatureRow, col);
    cell.value = text;
    cell.font = { name: FONT, size: 11, bold: true };
    cell.alignment = { horizontal: 'center' };
  }

  // Một trang A4 ngang, in là xong (doitac-0911 #010).
  printReady(sheet, 'F', { onePage: true });
}

function buildTransactionSheet(
  sheet: Worksheet,
  data: ReconciliationWorkbookData,
): void {
  // Cột lấy đúng theo sheet mẫu "Mẫu file Chi tiết giao dịch".
  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    // A whole order code in Times 11, printed (doitac-0911 #010).
    { header: 'Mã đơn hàng', key: 'orderNumber', width: 33 },
    { header: 'Tên sản phẩm', key: 'products', width: 40 },
    { header: 'Doanh thu đơn hàng', key: 'revenueVnd', width: 20 },
    { header: 'Nguồn ghi nhận', key: 'source', width: 22 },
    { header: 'Khách hàng', key: 'customer', width: 16 },
    { header: 'Số lượng eSIM', key: 'esims', width: 14 },
    { header: 'Mức % hoa hồng', key: 'commissionPercent', width: 16 },
    { header: 'Tiền hoa hồng', key: 'commissionVnd', width: 18 },
    { header: 'Trạng thái đơn hàng', key: 'status', width: 20 },
    { header: 'Ngày đặt hàng', key: 'createdAt', width: 14 },
  ];
  const COLS = 11;

  // Nền xanh dương, chữ trắng như sheet mẫu (doitac-0911 #010).
  const header = sheet.getRow(1);
  header.font = {
    name: FONT,
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  header.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  header.height = 30;
  for (let c = 1; c <= COLS; c++) {
    header.getCell(c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
  }

  data.transactions.forEach((tx, index) => {
    sheet.addRow({
      stt: index + 1,
      orderNumber: tx.orderNumber,
      products: tx.products,
      revenueVnd: tx.revenueVnd,
      source: tx.source,
      customer: tx.customer,
      esims: tx.esims,
      // 18.1141 → 18.11 (doitac-0911 #010); "0.##" would print "20.".
      commissionPercent:
        tx.commissionPercent == null
          ? ''
          : Math.round(tx.commissionPercent * 100) / 100,
      commissionVnd: tx.commissionVnd,
      status: tx.status,
      createdAt: ddmmyyyy(tx.createdAt),
    });
  });

  // Dòng tổng: con số hoa hồng ở đây phải khớp mục I của biên bản, nếu không
  // thì hai sheet nói hai điều khác nhau về cùng một kỳ.
  const totalRow = sheet.addRow({
    orderNumber: 'TỔNG CỘNG',
    revenueVnd: data.transactions.reduce((sum, t) => sum + t.revenueVnd, 0),
    esims: data.transactions.reduce((sum, t) => sum + t.esims, 0),
    commissionVnd: data.transactions.reduce(
      (sum, t) => sum + t.commissionVnd,
      0,
    ),
  });
  for (let r = 2; r <= sheet.rowCount; r++) {
    sheet.getCell(r, 4).numFmt = MONEY_FORMAT;
    sheet.getCell(r, 9).numFmt = MONEY_FORMAT;
    // Cỡ 11; tên sản phẩm dài xuống dòng thay vì bị cắt khi in
    // (doitac-0911 #010).
    const line = sheet.getRow(r);
    line.font = { name: FONT, size: 11 };
    line.alignment = { vertical: 'middle' };
    line.getCell(3).alignment = { vertical: 'middle', wrapText: true };
    line.height = wrappedRowHeight(String(line.getCell(3).value ?? ''), 40);
  }
  totalRow.font = { name: FONT, size: 11, bold: true };

  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= COLS; c++) {
      sheet.getCell(r, c).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  // Ngang, vừa chiều ngang trang, dòng tiêu đề lặp lại ở mỗi trang
  // (doitac-0911 #010).
  printReady(sheet, 'K', { repeatHeader: true });
}

/** Dựng file .xlsx hai sheet để đính kèm email đối soát. */
export async function buildReconciliationWorkbook(
  data: ReconciliationWorkbookData,
): Promise<Buffer> {
  const wb = new Workbook();
  wb.creator = data.partyA.name;
  wb.created = data.issuedAt;

  buildStatementSheet(wb.addWorksheet('Đối soát'), {
    ...data,
    kind: 'commission',
    totalVnd: data.commissionVnd,
  });
  buildTransactionSheet(wb.addWorksheet('Chi tiết giao dịch'), data);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
