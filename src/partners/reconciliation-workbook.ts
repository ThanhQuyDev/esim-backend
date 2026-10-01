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
  partyA: ReconciliationParty;
  partyB: ReconciliationParty;
  /** Ngày đầu và ngày cuối của kỳ đối soát. */
  periodStart: Date;
  periodEnd: Date;
  /** Ngày lập biên bản — "Hôm nay ngày …". */
  issuedAt: Date;
  /** Các dòng "Căn cứ…", lấy từ `partner.contractInfo`. */
  contractLines: string[];
  /** Hoa hồng của kỳ, trước thuế. */
  commissionVnd: number;
  /** Thuế suất VAT, phần trăm. */
  vatPercent: number;
  transactions: ReconciliationTransaction[];
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
  cell.font = {
    name: FONT,
    size: opts.size ?? 12,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
  };
  cell.alignment = {
    horizontal: opts.center ? 'center' : 'left',
    vertical: 'middle',
    wrapText: true,
  };
}

function buildStatementSheet(
  sheet: Worksheet,
  data: ReconciliationWorkbookData,
): void {
  sheet.columns = [
    { width: 6 },
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
  motto.font = { name: FONT, size: 12, bold: true };
  motto.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  sheet.getRow(1).height = 36;

  sheet.mergeCells('E3:F3');
  const issued = sheet.getCell('E3');
  issued.value = `Ngày ${ddmmyyyy(data.issuedAt)}`;
  issued.font = { name: FONT, size: 12, italic: true };
  issued.alignment = { horizontal: 'center' };

  fullWidthRow(sheet, 4, 'BIÊN BẢN ĐỐI SOÁT DOANH THU, HOA HỒNG', {
    bold: true,
    center: true,
    size: 14,
  });
  fullWidthRow(
    sheet,
    5,
    `Từ ngày ${ddmmyyyy(data.periodStart)} đến ngày ${ddmmyyyy(data.periodEnd)}`,
    { center: true, italic: true },
  );

  // ── Hai bên ───────────────────────────────────────────────────────────
  let row = 7;
  const party = (label: string, p: ReconciliationParty) => {
    fullWidthRow(sheet, row++, `${label}: ${p.name}`, { bold: true });
    fullWidthRow(sheet, row++, `Địa chỉ: ${p.address}`);
    fullWidthRow(sheet, row++, `MST: ${p.taxCode}`);

    // Đại diện và chức vụ nằm cùng một dòng, như file mẫu.
    sheet.mergeCells(row, 1, row, 3);
    sheet.mergeCells(row, 4, row, 6);
    const rep = sheet.getCell(row, 1);
    rep.value = `Đại diện: ${p.representative}`;
    rep.font = { name: FONT, size: 12 };
    const pos = sheet.getCell(row, 4);
    pos.value = `Chức vụ: ${p.position ?? ''}`;
    pos.font = { name: FONT, size: 12 };
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
    `Hôm nay ngày ${ddmmyyyy(data.issuedAt)}, hai bên cùng đối chiếu và xác nhận như sau:`,
  );
  row++;

  // ── I. Chia sẻ doanh thu ──────────────────────────────────────────────
  fullWidthRow(sheet, row++, 'I. Chia sẻ doanh thu cho đối tác đạt:', {
    bold: true,
  });

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

  const vat = Math.round((data.commissionVnd * data.vatPercent) / 100);
  const total = data.commissionVnd + vat;

  const moneyRows: [string, string, number][] = [
    [
      '1',
      `Chia sẻ doanh thu bán hàng tháng ${mmyyyy(data.periodStart)}`,
      data.commissionVnd,
    ],
    ['2', 'Tổng số tiền trước thuế VAT', data.commissionVnd],
    ['3', `Thuế VAT (${data.vatPercent}%)`, vat],
    ['4', 'Tổng số tiền (gồm VAT)', total],
  ];

  for (const [stt, label, amount] of moneyRows) {
    sheet.mergeCells(row, 2, row, 4);
    sheet.getCell(row, 1).value = stt;
    sheet.getCell(row, 1).alignment = { horizontal: 'center' };
    sheet.getCell(row, 2).value = label;
    // Chỉ dòng đầu ghi đơn vị, như file mẫu.
    if (stt === '1') sheet.getCell(row, 5).value = 'VNĐ';
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

  sheet.mergeCells(row, 1, row, 5);
  const payableLabel = sheet.getCell(row, 1);
  payableLabel.value = `Tổng số tiền Bên A phải thanh toán cho Bên B (đã bao gồm thuế) tính đến ngày ${ddmmyyyy(
    data.periodEnd,
  )} là:`;
  payableLabel.font = { name: FONT, size: 12 };
  payableLabel.alignment = { wrapText: true, vertical: 'middle' };
  const payable = sheet.getCell(row, 6);
  payable.value = total;
  payable.numFmt = MONEY_FORMAT;
  payable.font = { name: FONT, size: 12, bold: true };
  payable.alignment = { horizontal: 'right' };
  row++;

  fullWidthRow(sheet, row++, `Bằng chữ: ${vndInWords(total)}`, {
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
    cell.font = { name: FONT, size: 12, bold: true };
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
    cell.font = { name: FONT, size: 12, bold: true };
    cell.alignment = { horizontal: 'center' };
  }
}

function buildTransactionSheet(
  sheet: Worksheet,
  data: ReconciliationWorkbookData,
): void {
  // Cột lấy đúng theo sheet mẫu "Mẫu file Chi tiết giao dịch".
  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Mã đơn hàng', key: 'orderNumber', width: 28 },
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

  const header = sheet.getRow(1);
  header.font = { name: FONT, size: 12, bold: true };
  header.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  header.height = 30;

  data.transactions.forEach((tx, index) => {
    sheet.addRow({
      stt: index + 1,
      orderNumber: tx.orderNumber,
      products: tx.products,
      revenueVnd: tx.revenueVnd,
      source: tx.source,
      customer: tx.customer,
      esims: tx.esims,
      commissionPercent: tx.commissionPercent ?? '',
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
  totalRow.font = { name: FONT, size: 12, bold: true };

  for (let r = 2; r <= sheet.rowCount; r++) {
    sheet.getCell(r, 4).numFmt = MONEY_FORMAT;
    sheet.getCell(r, 9).numFmt = MONEY_FORMAT;
  }

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
}

/** Dựng file .xlsx hai sheet để đính kèm email đối soát. */
export async function buildReconciliationWorkbook(
  data: ReconciliationWorkbookData,
): Promise<Buffer> {
  const wb = new Workbook();
  wb.creator = data.partyA.name;
  wb.created = data.issuedAt;

  buildStatementSheet(wb.addWorksheet('Đối soát'), data);
  buildTransactionSheet(wb.addWorksheet('Chi tiết giao dịch'), data);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
