import { Workbook } from 'exceljs';

/**
 * The eSIMs of a bulk "file" order as one spreadsheet (vande #057).
 *
 * A travel agency hands each traveller their own eSIM, so nothing is mailed:
 * the list carries everything needed to install and to answer the customer —
 * the plan, its allowances, the LPA and a link to the QR picture. The
 * supplier and the cost price are esim.vn's own business and only go into
 * the admin's copy.
 */

export type BulkEsimRow = {
  orderNumber: string;
  iccid: string;
  planName: string;
  destination: string;
  planType: string | null;
  durationDays: number | null;
  dataMb: number | null;
  fupSpeed: string | null;
  phoneNumber: string | null;
  call: number | null;
  sms: number | null;
  topUp: boolean;
  /** "Mã gói cước" — the supplier's package code. */
  packageCode: string | null;
  slug: string | null;
  provider: string | null;
  costVnd: number | null;
  priceVnd: number;
  priceUsd: number;
  createdBy: string;
  orderedAt: Date;
  activationDeadline: string | null;
  lpa: string;
  qrUrl: string;
};

const TYPE_LABEL: Record<string, string> = {
  fixed: 'Cố định',
  daily: 'Theo ngày',
  unlimited: 'Không giới hạn',
  'unlimited-reduce': 'Không giới hạn giảm tốc',
};

function dataText(row: BulkEsimRow): string {
  const mb = Number(row.dataMb ?? 0);
  const amount =
    mb <= 0
      ? 'Không giới hạn'
      : mb >= 1024
        ? `${Math.round((mb / 1024) * 100) / 100} GB`
        : `${Math.round(mb)} MB`;
  return row.planType === 'daily' && mb > 0 ? `${amount} / ngày` : amount;
}

/** dd/mm/yyyy hh:mm in Vietnam. */
function vnDateTime(date: Date): string {
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  });
}

/** `2026-11-30` → `30/11/2026`. */
function vnDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export async function buildBulkEsimList(
  rows: BulkEsimRow[],
  options: { forAdmin: boolean },
): Promise<Buffer> {
  const wb = new Workbook();
  wb.creator = 'esim.vn';
  const sheet = wb.addWorksheet('Danh sách eSIM');
  const money = '#,##0';
  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Mã đơn hàng mua', key: 'orderNumber', width: 30 },
    { header: 'ICCID', key: 'iccid', width: 24 },
    { header: 'Tên gói cước', key: 'planName', width: 36 },
    { header: 'Điểm đến', key: 'destination', width: 18 },
    { header: 'Loại gói', key: 'type', width: 18 },
    { header: 'Thời gian', key: 'days', width: 11 },
    { header: 'Data', key: 'data', width: 16 },
    { header: 'Số điện thoại', key: 'phone', width: 16 },
    { header: 'Gọi điện', key: 'call', width: 10 },
    { header: 'SMS', key: 'sms', width: 8 },
    { header: 'Hỗ trợ Topup', key: 'topUp', width: 12 },
    { header: 'Mã gói cước', key: 'packageCode', width: 24 },
    { header: 'Slug', key: 'slug', width: 32 },
    ...(options.forAdmin
      ? [
          { header: 'Nhà cung cấp', key: 'provider', width: 14 },
          {
            header: 'Giá vốn (VND)',
            key: 'cost',
            width: 14,
            style: { numFmt: money },
          },
        ]
      : []),
    {
      header: 'Giá bán (VND)',
      key: 'priceVnd',
      width: 14,
      style: { numFmt: money },
    },
    {
      header: 'Giá bán ($)',
      key: 'priceUsd',
      width: 12,
      style: { numFmt: '"$"#,##0.00' },
    },
    { header: 'Người tạo', key: 'createdBy', width: 28 },
    { header: 'Ngày giờ đặt hàng', key: 'orderedAt', width: 20 },
    { header: 'Ngày hết hạn kích hoạt', key: 'deadline', width: 20 },
    { header: 'Mã LPA', key: 'lpa', width: 52 },
    { header: 'Link xem/tải mã QR', key: 'qr', width: 60 },
  ];

  rows.forEach((row, index) => {
    const added = sheet.addRow({
      stt: index + 1,
      orderNumber: row.orderNumber,
      iccid: row.iccid,
      planName: row.planName,
      destination: row.destination,
      type: TYPE_LABEL[row.planType ?? ''] ?? row.planType ?? '',
      days: row.durationDays ? `${row.durationDays} ngày` : '',
      data: dataText(row),
      phone: row.phoneNumber ?? '',
      call: Number(row.call) > 0 ? `${row.call} phút` : 'Không',
      sms: Number(row.sms) > 0 ? Number(row.sms) : 'Không',
      topUp: row.topUp ? 'Có' : 'Không',
      packageCode: row.packageCode ?? '',
      slug: row.slug ?? '',
      ...(options.forAdmin
        ? { provider: row.provider ?? '', cost: row.costVnd ?? '' }
        : {}),
      priceVnd: row.priceVnd,
      priceUsd: row.priceUsd,
      createdBy: row.createdBy,
      orderedAt: vnDateTime(row.orderedAt),
      deadline: vnDate(row.activationDeadline),
      lpa: row.lpa,
      qr: row.qrUrl,
    });
    // A clickable link, not text to copy (vande #057).
    if (row.qrUrl) {
      added.getCell('qr').value = { text: row.qrUrl, hyperlink: row.qrUrl };
      added.getCell('qr').font = {
        color: { argb: 'FF0563C1' },
        underline: true,
      };
    }
  });

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle', wrapText: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Rows one bulk upload takes (vande #057; "Đặt đơn hộ khách" stays at 20). */
export const BULK_ORDER_MAX_ROWS = 50;

/** Seconds between two eSIM emails of one bulk upload, unless set otherwise. */
export const BULK_EMAIL_DEFAULT_INTERVAL_SEC = 30;
const BULK_EMAIL_MAX_INTERVAL_SEC = 600;

/** The interval a user typed, kept to 0–600 seconds; blank means 30. */
export function bulkEmailInterval(value: number | null | undefined): number {
  const seconds = Math.round(Number(value));
  if (value == null || !Number.isFinite(seconds)) {
    return BULK_EMAIL_DEFAULT_INTERVAL_SEC;
  }
  return Math.min(BULK_EMAIL_MAX_INTERVAL_SEC, Math.max(0, seconds));
}

/** What marks an order as part of a bulk upload. */
export type BulkOrderTag = {
  mode: 'email' | 'file';
  /** Shared by every order of one upload. */
  batch: string;
  intervalSec: number;
};
