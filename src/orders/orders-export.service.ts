import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  OrderRepository,
  ReconciliationExportRow,
} from './infrastructure/persistence/order.repository';
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
 * Revenue and cost per order, summed over its lines (#018).
 *
 * "Lợi nhuận sau giảm giá" is an ORDER-level figure — the discount applies to the
 * order, not to one supplier's line — so it needs the whole order's totals, not
 * the line the row happens to be.
 */
function summarizeByOrder(
  rows: ReconciliationExportRow[],
): Map<number, { revenue: number; cost: number }> {
  const totals = new Map<number, { revenue: number; cost: number }>();
  for (const row of rows) {
    // A refunded line earns nothing and cost nothing, same rule as the totals.
    if (row.itemStatus === 'refunded') continue;
    const current = totals.get(row.orderId) ?? { revenue: 0, cost: 0 };
    current.revenue += row.vndPrice;
    current.cost += row.vndCostPrice;
    totals.set(row.orderId, current);
  }
  return totals;
}

/** eSIM / Affiliate / Topup, the same three kinds the list filters by (#017). */
function orderKindLabel(row: ReconciliationExportRow): string {
  if (row.orderType === 'TOPUP') return 'Topup';
  if (row.partnerCommissionVnd > 0 || row.partnerName) return 'Affiliate';
  return 'eSIM';
}

/** Commission as a share of what the order brought in; blank when there is none. */
function commissionPercent(commissionVnd: number, revenueVnd: number): string {
  if (!(commissionVnd > 0) || !(revenueVnd > 0)) return '';
  return `${Math.round((commissionVnd / revenueVnd) * 1000) / 10}%`;
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
      { header: 'Loại đơn', key: 'orderKind', width: 14 },
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
      // Order-level columns (#018): written once per order, on its first line.
      { header: 'Hình thức thanh toán', key: 'paymentMethod', width: 20 },
      { header: 'Mã giảm giá', key: 'couponCode', width: 16 },
      { header: 'Mã giới thiệu', key: 'referralCode', width: 16 },
      { header: 'Tiền giảm giá (VNĐ)', key: 'discountVnd', width: 18 },
      {
        header: 'Lợi nhuận sau giảm giá (VNĐ)',
        key: 'profitAfterDiscount',
        width: 26,
      },
      { header: 'Tiền hoàn eXU (VNĐ)', key: 'cashbackAmountVnd', width: 20 },
      {
        header: 'Tiền dùng từ ví eXU (VNĐ)',
        key: 'walletSpentVndAmount',
        width: 24,
      },
      { header: 'Đối tác Affiliate', key: 'partnerName', width: 26 },
      { header: 'Hoa hồng (VNĐ)', key: 'partnerCommissionVnd', width: 16 },
      { header: '% hoa hồng', key: 'partnerCommissionPercent', width: 12 },
      { header: 'Trạng thái hóa đơn', key: 'invoiceStatus', width: 18 },
      { header: 'Công ty xuất hóa đơn', key: 'invoiceCompanyName', width: 30 },
      { header: 'Mã số thuế', key: 'invoiceTaxCode', width: 16 },
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
    let totalDiscount = 0;
    let totalCommission = 0;
    let totalCashback = 0;

    // Order-level money is written on the FIRST line of each order only, so a
    // plain SUM over those columns is right even for a multi-line order (#018).
    const orderTotals = summarizeByOrder(rows);
    const seenOrders = new Set<number>();

    for (const row of rows) {
      // A refunded line is kept in the sheet — it has to be visible during
      // reconciliation — but it must not inflate the totals owed.
      const counts = row.itemStatus !== 'refunded';
      if (counts) {
        totalCost += row.vndCostPrice;
        totalRevenue += row.vndPrice;
      }

      const firstLineOfOrder = !seenOrders.has(row.orderId);
      seenOrders.add(row.orderId);

      const discountVnd =
        row.couponDiscountVndAmount + row.referralDiscountVndAmount;
      const totalsForOrder = orderTotals.get(row.orderId);
      const profitAfterDiscount =
        (totalsForOrder?.revenue ?? 0) -
        (totalsForOrder?.cost ?? 0) -
        discountVnd;

      if (firstLineOfOrder) {
        totalDiscount += discountVnd;
        totalCommission += row.partnerCommissionVnd;
        totalCashback += row.cashbackAmountVnd;
      }

      worksheet.addRow({
        orderNumber: row.orderNumber,
        orderCreatedAt: formatVnDateTime(row.orderCreatedAt),
        orderKind: orderKindLabel(row),
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
        ...(firstLineOfOrder
          ? {
              paymentMethod: row.paymentMethod ?? '',
              couponCode: row.couponCode ?? '',
              referralCode: row.referralCode ?? '',
              discountVnd,
              profitAfterDiscount,
              cashbackAmountVnd: row.cashbackAmountVnd,
              walletSpentVndAmount: row.walletSpentVndAmount,
              partnerName: row.partnerName ?? '',
              partnerCommissionVnd: row.partnerCommissionVnd || '',
              partnerCommissionPercent: commissionPercent(
                row.partnerCommissionVnd,
                totalsForOrder?.revenue ?? 0,
              ),
              invoiceStatus: row.invoiceStatus ?? '',
              invoiceCompanyName: row.invoiceCompanyName ?? '',
              invoiceTaxCode: row.invoiceTaxCode ?? '',
            }
          : {}),
      });
    }

    // Totals line, so the sheet can be checked against a supplier statement
    // without building a formula first.
    const totalRow = worksheet.addRow({
      planName: `TỔNG (${rows.length} dòng / ${orderTotals.size} đơn, chưa tính dòng đã hoàn tiền)`,
      vndCostPrice: totalCost,
      vndPrice: totalRevenue,
      profit: totalRevenue - totalCost,
      // Order-level sums: counted once per order, not once per line (#018).
      discountVnd: totalDiscount,
      profitAfterDiscount: totalRevenue - totalCost - totalDiscount,
      partnerCommissionVnd: totalCommission,
      cashbackAmountVnd: totalCashback,
    });
    totalRow.font = { bold: true };

    for (const key of [
      'vndCostPrice',
      'vndPrice',
      'profit',
      'discountVnd',
      'profitAfterDiscount',
      'cashbackAmountVnd',
      'walletSpentVndAmount',
      'partnerCommissionVnd',
    ]) {
      worksheet.getColumn(key).numFmt = '#,##0';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
