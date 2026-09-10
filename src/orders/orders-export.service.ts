import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { OrderRepository } from './infrastructure/persistence/order.repository';
import { FilterOrderDto } from './dto/query-order.dto';

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** `dd/MM/yyyy HH:mm` in Vietnam time — the books are kept on VN time. */
function formatVnDateTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { timeZone: VN_TIME_ZONE });
}

/**
 * Timestamp for the file name, e.g. `2026-09-09_16-45-30`.
 * Vietnam time so the name matches the numbers inside the sheet.
 */
export function exportFileTimestamp(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '00';

  return (
    `${get('year')}-${get('month')}-${get('day')}` +
    `_${get('hour')}-${get('minute')}-${get('second')}`
  );
}

/**
 * Supplier-reconciliation export (#028).
 *
 * One row per ORDER ITEM, not per order: an order can carry lines from three
 * different suppliers and each supplier is settled separately, so an
 * order-level sheet could not be reconciled at all.
 */
@Injectable()
export class OrdersExportService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async exportToExcel(filterOptions?: FilterOrderDto | null): Promise<Buffer> {
    const rows =
      await this.orderRepository.findAllForReconciliationExport(filterOptions);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'eSIM Management System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Đối soát đơn hàng');

    worksheet.columns = [
      { header: 'Mã đơn', key: 'orderNumber', width: 22 },
      { header: 'Ngày đặt', key: 'orderCreatedAt', width: 20 },
      { header: 'Trạng thái đơn', key: 'orderStatus', width: 14 },
      { header: 'Khách hàng', key: 'customerEmail', width: 28 },
      { header: 'Nhà cung cấp', key: 'provider', width: 16 },
      { header: 'Tên gói', key: 'planName', width: 34 },
      { header: 'Mã gói NCC', key: 'providerPlanId', width: 22 },
      { header: 'Mã đơn NCC', key: 'providerOrderRef', width: 24 },
      { header: 'ICCID', key: 'iccids', width: 26 },
      { header: 'SL', key: 'quantity', width: 6 },
      { header: 'Giá vốn (VNĐ)', key: 'vndCostPrice', width: 16 },
      { header: 'Doanh thu (VNĐ)', key: 'vndPrice', width: 16 },
      { header: 'Lợi nhuận (VNĐ)', key: 'profit', width: 16 },
      { header: 'Trạng thái dòng', key: 'itemStatus', width: 16 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let totalCost = 0;
    let totalRevenue = 0;

    for (const row of rows) {
      // A refunded line is kept in the sheet — it has to be visible during
      // reconciliation — but it must not inflate the totals owed.
      const counts = row.itemStatus !== 'refunded';
      if (counts) {
        totalCost += row.vndCostPrice;
        totalRevenue += row.vndPrice;
      }

      worksheet.addRow({
        orderNumber: row.orderNumber,
        orderCreatedAt: formatVnDateTime(row.orderCreatedAt),
        orderStatus: row.orderStatus,
        customerEmail: row.customerEmail ?? '',
        provider: row.provider ?? '',
        planName: row.planName ?? '',
        providerPlanId: row.providerPlanId ?? '',
        providerOrderRef: row.providerOrderRef ?? '',
        iccids: row.iccids ?? '',
        quantity: row.quantity,
        vndCostPrice: row.vndCostPrice,
        vndPrice: row.vndPrice,
        profit: row.vndPrice - row.vndCostPrice,
        itemStatus: row.itemStatus,
      });
    }

    // Totals line, so the sheet can be checked against a supplier statement
    // without building a formula first.
    const totalRow = worksheet.addRow({
      planName: `TỔNG (${rows.length} dòng, chưa tính dòng đã hoàn tiền)`,
      vndCostPrice: totalCost,
      vndPrice: totalRevenue,
      profit: totalRevenue - totalCost,
    });
    totalRow.font = { bold: true };

    for (const key of ['vndCostPrice', 'vndPrice', 'profit']) {
      worksheet.getColumn(key).numFmt = '#,##0';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
