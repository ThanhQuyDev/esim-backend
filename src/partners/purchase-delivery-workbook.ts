import { Workbook } from 'exceljs';

/**
 * File Excel giao eSIM cho đối tác phân phối (#046).
 *
 * Chốt 02/10/2026: đối tác mua xong **tải về một file Excel**, không nhận email
 * từng eSIM. Đối tác bán lại cho khách của họ, nên mỗi dòng phải đủ để khách
 * cài được eSIM mà không cần hỏi lại esim.vn: LPA là chuỗi duy nhất mọi máy đều
 * nhận, QR chỉ là cách nhìn khác của chính chuỗi đó.
 *
 * Không có cột giá niêm yết trong file này. Đối tác bán theo giá của họ; in sẵn
 * giá esim.vn lên tờ giao hàng là đưa cho khách cuối một con số để mặc cả.
 */

export type PurchasedEsim = {
  iccid: string;
  /** `LPA:1$<smdp>$<code>` — chuỗi cài đặt, trống khi nhà cung cấp chưa trả. */
  lpa: string | null;
  smdpAddress: string | null;
  activationCode: string | null;
  qrcode: string | null;
  /** APN phải khai tay trên một số gói, để trống nghĩa là không cần. */
  apnValue: string | null;
  status: string;
  /** Hạn kích hoạt hoặc hạn dùng, tuỳ gói. */
  expiresAt: Date | null;
};

export type PurchaseDeliveryData = {
  orderNumber: string;
  partnerName: string;
  planName: string;
  /** Ngày đặt, để đối tác đối chiếu với màn hình đơn hàng. */
  orderedAt: Date;
  quantity: number;
  unitPriceVnd: number;
  totalVnd: number;
  esims: PurchasedEsim[];
};

const HEADERS = [
  'STT',
  'ICCID',
  'Mã cài đặt (LPA)',
  'SM-DP+',
  'Activation code',
  'APN',
  'Trạng thái',
  'Hạn sử dụng',
] as const;

/** Bề rộng cột, theo nội dung thật: LPA là chuỗi dài nhất. */
const WIDTHS = [6, 24, 58, 30, 26, 14, 16, 14];

const vi = (value: Date): string =>
  `${String(value.getDate()).padStart(2, '0')}/${String(
    value.getMonth() + 1,
  ).padStart(2, '0')}/${value.getFullYear()}`;

/**
 * Chuỗi cài đặt của một eSIM.
 *
 * Nhà cung cấp lúc trả `lpa` sẵn, lúc chỉ trả SM-DP+ và activation code. Ghép
 * lại theo đúng định dạng GSMA thay vì để trống, vì một ô trống ở đây nghĩa là
 * đối tác phải mở từng eSIM trên web mới bán được hàng.
 */
export function installString(esim: PurchasedEsim): string {
  const lpa = esim.lpa?.trim();
  if (lpa) return lpa;
  const smdp = esim.smdpAddress?.trim();
  const code = esim.activationCode?.trim();
  if (smdp && code) return `LPA:1$${smdp}$${code}`;
  return '';
}

/**
 * Dựng workbook giao hàng cho một đơn.
 *
 * Một sheet: phần đầu là thông tin đơn, sau đó là bảng eSIM. Gộp chung thay vì
 * tách hai sheet để đối tác in ra hoặc gửi tiếp cho nhân viên bán hàng của họ
 * chỉ cần một tờ.
 */
export async function buildPurchaseDeliveryWorkbook(
  data: PurchaseDeliveryData,
): Promise<Buffer> {
  const wb = new Workbook();
  wb.creator = 'eSIM.vn';
  wb.created = new Date();

  const ws = wb.addWorksheet('eSIM đã mua');
  WIDTHS.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });

  const title = ws.addRow([`ĐƠN HÀNG ${data.orderNumber}`]);
  title.font = { bold: true, size: 14 };
  ws.mergeCells(title.number, 1, title.number, HEADERS.length);

  for (const [label, value] of [
    ['Đối tác', data.partnerName],
    ['Gói', data.planName],
    ['Ngày đặt', vi(data.orderedAt)],
    ['Số lượng', `${data.quantity.toLocaleString('vi-VN')} eSIM`],
    [
      'Giá vốn',
      `${data.unitPriceVnd.toLocaleString('vi-VN')}đ × ${data.quantity} = ${data.totalVnd.toLocaleString('vi-VN')}đ`,
    ],
  ]) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    ws.mergeCells(row.number, 2, row.number, HEADERS.length);
  }

  ws.addRow([]);

  const header = ws.addRow([...HEADERS]);
  header.font = { bold: true };
  header.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };
  header.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFEFEF' },
    };
  });

  data.esims.forEach((esim, index) => {
    const row = ws.addRow([
      index + 1,
      esim.iccid,
      installString(esim),
      esim.smdpAddress ?? '',
      esim.activationCode ?? '',
      esim.apnValue ?? '',
      esim.status,
      esim.expiresAt ? vi(esim.expiresAt) : '',
    ]);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { vertical: 'top' };
    });
    // ICCID và mã cài đặt là chuỗi số dài — Excel sẽ đổi sang ký hiệu khoa học
    // và làm hỏng mã nếu không ép định dạng text.
    row.getCell(2).numFmt = '@';
    row.getCell(3).numFmt = '@';
  });

  if (data.esims.length === 0) {
    const row = ws.addRow(['Đơn chưa có eSIM nào được cấp.']);
    ws.mergeCells(row.number, 1, row.number, HEADERS.length);
    row.font = { italic: true };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Tên file tải về, an toàn trên Windows lẫn trình duyệt. */
export function purchaseDeliveryFilename(orderNumber: string): string {
  const safe = orderNumber.replace(/[^A-Za-z0-9_-]/g, '-');
  return `esim-${safe}.xlsx`;
}
