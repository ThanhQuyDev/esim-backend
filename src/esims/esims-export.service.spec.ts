import * as ExcelJS from 'exceljs';
import {
  EsimsExportService,
  exportPlanTypeLabel,
  exportSaleStatusLabel,
} from './esims-export.service';

/**
 * #011 — the eSIM export has to carry what the admin actually works with: the
 * plan name, its validity, the plan type and whether the eSIM is sold. Before,
 * a row was an ICCID and a bare plan id.
 */

const CREATED_AT = new Date('2026-09-10T03:00:00.000Z');

function esim(overrides: Record<string, unknown>) {
  return {
    id: 1,
    iccid: '8984000000000000001',
    provider: 'viettel',
    status: 'available',
    phoneNumber: null,
    esimTranNo: null,
    smdpAddress: null,
    activationCode: null,
    lpa: null,
    apnValue: null,
    isRoaming: null,
    dataUsed: null,
    dataTotal: null,
    userId: null,
    planId: 7,
    orderItemId: null,
    activatedAt: null,
    expiresAt: null,
    createdAt: CREATED_AT,
    plan: {
      id: 7,
      name: 'Viettel 5GB/ngày',
      durationDays: 30,
      type: 'daily',
    },
    ...overrides,
  };
}

async function exportRows(esims: unknown[]) {
  const service = new EsimsExportService({
    findAllForExport: jest.fn().mockResolvedValue(esims),
  } as never);

  const buffer = await service.exportToExcel();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.getWorksheet('eSIM Data')!;

  const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const values = (sheet.getRow(r).values as unknown[]).slice(1);
    rows.push(
      Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ''])),
    );
  }
  return { sheet, headers, rows };
}

describe('eSIM export columns (#011)', () => {
  it('should add plan name, validity, plan type and sale status', async () => {
    const { headers } = await exportRows([esim({})]);

    expect(headers).toEqual(
      expect.arrayContaining([
        'Tên gói',
        'Thời hạn (ngày)',
        'Loại gói',
        'Trạng thái bán',
      ]),
    );
    // Right after the supplier, where they are easy to find.
    expect(headers.slice(0, 7)).toEqual([
      'ID',
      'ICCID',
      'Provider',
      'Tên gói',
      'Thời hạn (ngày)',
      'Loại gói',
      'Trạng thái bán',
    ]);
    // The raw status is kept for anything already reading it.
    expect(headers).toContain('Status');
  });

  it('should fill them with the labels the CMS shows', async () => {
    const { rows } = await exportRows([
      esim({}),
      esim({
        id: 2,
        iccid: '8984000000000000002',
        status: 'sold',
        plan: { id: 8, name: 'Japan 10GB', durationDays: 7, type: 'fixed' },
      }),
    ]);

    expect(rows[0]).toMatchObject({
      'Tên gói': 'Viettel 5GB/ngày',
      'Thời hạn (ngày)': 30,
      'Loại gói': 'Theo ngày',
      'Trạng thái bán': 'Chưa bán',
      Status: 'available',
    });
    expect(rows[1]).toMatchObject({
      'Tên gói': 'Japan 10GB',
      'Thời hạn (ngày)': 7,
      'Loại gói': 'Cố định',
      'Trạng thái bán': 'Đã bán',
    });
  });

  it('should leave the plan columns blank for an eSIM with no plan', async () => {
    const { rows } = await exportRows([esim({ planId: null, plan: null })]);

    expect(rows[0]).toMatchObject({
      'Tên gói': '',
      'Thời hạn (ngày)': '',
      'Loại gói': '',
      'Trạng thái bán': 'Chưa bán',
    });
  });

  it('should cover every column with the auto-filter', async () => {
    const { sheet, headers } = await exportRows([esim({})]);
    // Read back from the file, ExcelJS gives the filter as a range ("A1:W2").
    const filter = sheet.autoFilter as unknown;
    const lastCell =
      typeof filter === 'string'
        ? filter.split(':')[1]
        : String((filter as { to: string }).to);

    const lastColumn = sheet.getColumn(lastCell.replace(/\d+/g, '')).number;
    expect(lastColumn).toBe(headers.length);
  });

  it('should pass unknown plan types and statuses through unchanged', () => {
    expect(exportPlanTypeLabel('unlimited-reduce')).toBe(
      'Không giới hạn giảm tốc',
    );
    expect(exportPlanTypeLabel('data-in-total')).toBe('data-in-total');
    expect(exportPlanTypeLabel(null)).toBe('');
    expect(exportSaleStatusLabel('refunded')).toBe('Đã hoàn tiền');
    expect(exportSaleStatusLabel('pending')).toBe('pending');
  });
});
