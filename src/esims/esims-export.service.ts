import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EsimRepository } from './infrastructure/persistence/esim.repository';
import { FilterEsimDto } from './dto/query-esim.dto';
import { Esim } from './domain/esim';

@Injectable()
export class EsimsExportService {
  constructor(private readonly esimsRepository: EsimRepository) {}

  async exportToExcel(filterOptions?: FilterEsimDto | null): Promise<Buffer> {
    const esims = await this.esimsRepository.findAllForExport(filterOptions);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'eSIM Management System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('eSIM Data');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'ICCID', key: 'iccid', width: 25 },
      { header: 'Provider', key: 'provider', width: 15 },
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

    // Add data rows
    esims.forEach((esim: Esim) => {
      worksheet.addRow({
        id: esim.id,
        iccid: esim.iccid,
        provider: esim.provider ?? '',
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

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `S${esims.length + 1}`,
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private formatDate(date: Date): string {
    return new Date(date).toISOString().replace('T', ' ').substring(0, 19);
  }
}
