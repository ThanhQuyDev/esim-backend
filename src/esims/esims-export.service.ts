import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EsimRepository } from './infrastructure/persistence/esim.repository';
import { FilterEsimDto } from './dto/query-esim.dto';
import { Esim } from './domain/esim';

/**
 * Same wording as the CMS eSIM table (`esims-table/columns.tsx` and
 * `lib/esim-status.ts`), so the exported file reads like the screen it came
 * from.
 */
export const EXPORT_PLAN_TYPE_LABELS: Record<string, string> = {
  fixed: 'Cố định',
  daily: 'Theo ngày',
  unlimited: 'Không giới hạn',
  'unlimited-reduce': 'Không giới hạn giảm tốc',
};

export const EXPORT_SALE_STATUS_LABELS: Record<string, string> = {
  available: 'Chưa bán',
  sold: 'Đã bán',
  active: 'Đang dùng',
  expired: 'Hết hạn',
  deactivated: 'Đã huỷ kích hoạt',
  refunded: 'Đã hoàn tiền',
};

/** Plan type as the CMS labels it; unknown types pass through unchanged. */
export function exportPlanTypeLabel(type: string | null | undefined): string {
  if (!type) return '';
  return EXPORT_PLAN_TYPE_LABELS[type] ?? type;
}

/**
 * Call / SMS allowance of the plan behind an eSIM (#027).
 *
 * An eSIM has no minutes of its own — it inherits the plan's — so a row with no
 * plan loaded reports 0 rather than an empty cell that looks like a data error.
 */
function callMinutesOf(esim: Esim): number {
  return Number(esim.plan?.call) || 0;
}

function smsCountOf(esim: Esim): number {
  return Number(esim.plan?.sms) || 0;
}

/** Sale status as the CMS labels it; unknown statuses pass through unchanged. */
export function exportSaleStatusLabel(
  status: string | null | undefined,
): string {
  if (!status) return '';
  return EXPORT_SALE_STATUS_LABELS[status] ?? status;
}

@Injectable()
export class EsimsExportService {
  constructor(private readonly esimsRepository: EsimRepository) {}

  async exportToExcel(filterOptions?: FilterEsimDto | null): Promise<Buffer> {
    const rows = await this.esimsRepository.findAllForExport(filterOptions);

    // Which of these have been topped up (#025). One query for the whole file.
    const topups = await this.esimsRepository.countTopupsByIccids(
      rows.map((esim) => esim.iccid).filter(Boolean),
    );
    const esims = rows.map((esim) => {
      const topup = topups.get(esim.iccid);
      return {
        ...esim,
        topupCount: topup?.count ?? 0,
        lastTopupAt: topup?.lastAt ?? null,
        topupPackageNames: topup?.packageNames ?? '',
        topupVndPrice: topup?.vndPrice ?? 0,
        topupVndCostPrice: topup?.vndCostPrice ?? 0,
      };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'eSIM Management System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('eSIM Data');

    // Plan name, validity, plan type and sale status sit right after the
    // supplier (#011): they are what an admin sorts and filters the file by,
    // and without them every row was an ICCID with a bare plan id.
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'ICCID', key: 'iccid', width: 25 },
      { header: 'Provider', key: 'provider', width: 15 },
      { header: 'Tên gói', key: 'planName', width: 32 },
      { header: 'Thời hạn (ngày)', key: 'durationDays', width: 15 },
      { header: 'Loại gói', key: 'planType', width: 24 },
      { header: 'Trạng thái bán', key: 'saleStatus', width: 18 },
      // Call / SMS allowance of the plan behind the eSIM (#027).
      { header: 'Call/SMS', key: 'hasCallSms', width: 12 },
      { header: 'Số phút gọi', key: 'callMinutes', width: 14 },
      { header: 'Số SMS', key: 'smsCount', width: 12 },
      // Cost and selling price of the eSIM itself (#027). Both currencies are
      // maintained for every supplier since #009, so these are comparable.
      { header: 'Giá gốc eSIM (VNĐ)', key: 'esimCostVnd', width: 20 },
      { header: 'Giá bán eSIM (VNĐ)', key: 'esimPriceVnd', width: 20 },
      // Whether this eSIM has been topped up, and how often (#025).
      { header: 'Đã Topup', key: 'toppedUp', width: 12 },
      { header: 'Số lần Topup', key: 'topupCount', width: 14 },
      { header: 'Gói Topup', key: 'topupPackageNames', width: 34 },
      { header: 'Giá gốc Topup (VNĐ)', key: 'topupCostVnd', width: 20 },
      { header: 'Giá bán Topup (VNĐ)', key: 'topupPriceVnd', width: 20 },
      { header: 'Topup lần cuối', key: 'lastTopupAt', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Phone Number', key: 'phoneNumber', width: 18 },
      { header: 'eSIM Tran No', key: 'esimTranNo', width: 20 },
      { header: 'SMDP Address', key: 'smdpAddress', width: 30 },
      { header: 'Activation Code', key: 'activationCode', width: 30 },
      { header: 'LPA', key: 'lpa', width: 40 },
      { header: 'APN Value', key: 'apnValue', width: 15 },
      { header: 'Is Roaming', key: 'isRoaming', width: 12 },
      { header: 'Data Used', key: 'dataUsed', width: 12 },
      { header: 'Data Total', key: 'dataTotal', width: 12 },
      { header: 'User ID', key: 'userId', width: 10 },
      { header: 'Plan ID', key: 'planId', width: 10 },
      { header: 'Order Item ID', key: 'orderItemId', width: 14 },
      { header: 'Activated At', key: 'activatedAt', width: 20 },
      { header: 'Expires At', key: 'expiresAt', width: 20 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows. The rolled-up topup figures were attached above, so the row
    // type is wider than `Esim`.
    esims.forEach((esim) => {
      worksheet.addRow({
        id: esim.id,
        iccid: esim.iccid,
        provider: esim.provider ?? '',
        planName: esim.plan?.name ?? '',
        durationDays: esim.plan?.durationDays ?? '',
        planType: exportPlanTypeLabel(esim.plan?.type),
        saleStatus: exportSaleStatusLabel(esim.status),
        // Blank rather than "No"/0 for an eSIM never topped up, so the column
        // reads as a list of the ones that were.
        toppedUp: (esim.topupCount ?? 0) > 0 ? 'Topup' : '',
        topupCount: (esim.topupCount ?? 0) > 0 ? esim.topupCount : '',
        topupPackageNames: esim.topupPackageNames || '',
        topupCostVnd: esim.topupVndCostPrice || '',
        topupPriceVnd: esim.topupVndPrice || '',
        lastTopupAt: esim.lastTopupAt ? this.formatDate(esim.lastTopupAt) : '',
        // Call / SMS and the eSIM's own money columns (#027).
        hasCallSms:
          callMinutesOf(esim) > 0 || smsCountOf(esim) > 0 ? 'Có' : 'Không',
        callMinutes: callMinutesOf(esim) || '',
        smsCount: smsCountOf(esim) || '',
        esimCostVnd: Number(esim.plan?.vndCostPrice) || '',
        esimPriceVnd: Number(esim.plan?.vndPrice) || '',
        status: esim.status,
        phoneNumber: esim.phoneNumber ?? '',
        esimTranNo: esim.esimTranNo ?? '',
        smdpAddress: esim.smdpAddress ?? '',
        activationCode: esim.activationCode ?? '',
        lpa: esim.lpa ?? '',
        apnValue: esim.apnValue ?? '',
        isRoaming:
          esim.isRoaming != null ? (esim.isRoaming ? 'Yes' : 'No') : '',
        dataUsed: esim.dataUsed ?? '',
        dataTotal: esim.dataTotal ?? '',
        userId: esim.userId ?? '',
        planId: esim.planId ?? '',
        orderItemId: esim.orderItemId ?? '',
        activatedAt: esim.activatedAt ? this.formatDate(esim.activatedAt) : '',
        expiresAt: esim.expiresAt ? this.formatDate(esim.expiresAt) : '',
        createdAt: this.formatDate(esim.createdAt),
      });
    });

    // Auto-filter across every column. Sized from the column list rather than
    // a hard-coded last letter, which went stale as soon as a column was added.
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: esims.length + 1, column: worksheet.columns.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private formatDate(date: Date): string {
    return new Date(date).toISOString().replace('T', ' ').substring(0, 19);
  }
}
