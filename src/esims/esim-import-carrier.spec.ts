import { Workbook } from 'exceljs';
import { EsimsImportService } from './esims-import.service';

/**
 * Local carriers are imported with the same template as Viettel, so the file's
 * Carrier column often still reads "Viettel". The carrier chosen in the import
 * dialog has to win over that column, or every row lands on the wrong provider.
 */

const HEADERS = [
  'Country',
  'Country Code',
  'Plan ID',
  'Name',
  'Data',
  'Days',
  'Type',
  'Expried Time',
  'Carrier',
  'Network',
  'Throttled Speed',
  'APN',
  'Topup',
  'eKYC',
  'Hot-Spot',
  'Hot-Spot Allow',
  'Support Phone Number',
  'Call',
  'SMS',
  'ICCID',
  'Phone Number',
  'LPA',
  'SMDP Address',
  'Activation code',
  'Cost Price',
  'Sell Price',
];

async function buildWorkbook(carrierCell: string | null): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(HEADERS);
  const row: (string | number | null)[] = new Array(HEADERS.length).fill(null);
  row[0] = 'Vietnam';
  row[1] = 'VN';
  row[2] = 'LOCAL99';
  row[3] = 'Local 99K';
  row[4] = '5GB';
  row[5] = 30;
  row[6] = 'fixed';
  row[8] = carrierCell;
  row[19] = '8934079000000000099';
  row[24] = 99000;
  row[25] = 129000;
  sheet.addRow(row);
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function makeService() {
  const planCreates: Record<string, unknown>[] = [];
  const esimCreates: Record<string, unknown>[] = [];

  const service = new EsimsImportService(
    {
      findByIccidWithDeleted: jest.fn().mockResolvedValue(null),
      create: jest.fn((payload: Record<string, unknown>) => {
        esimCreates.push(payload);
        return Promise.resolve({ id: 1 });
      }),
    } as never,
    {
      create: jest.fn((payload: Record<string, unknown>) => {
        planCreates.push(payload);
        return Promise.resolve({ id: 7 });
      }),
    } as never,
    { findBySlug: jest.fn().mockResolvedValue(null) } as never,
    {
      findByCountryCode: jest.fn().mockResolvedValue({ id: 5 }),
      findByName: jest.fn().mockResolvedValue(null),
    } as never,
  );

  return { service, planCreates, esimCreates };
}

describe('Importing local eSIMs for a chosen carrier', () => {
  it('should use the chosen carrier over the file Carrier column', async () => {
    const { service, planCreates, esimCreates } = makeService();

    const result = await service.importFromExcel(
      await buildWorkbook('Viettel'),
      'Wintel',
    );

    expect(result.created).toBe(1);
    expect(planCreates[0].provider).toBe('wintel');
    expect(planCreates[0].slug).toBe('wintel-local99');
    expect(planCreates[0].operatorName).toBe('Wintel');
    expect(esimCreates[0].provider).toBe('wintel');
  });

  it('should fall back to the Carrier column when no carrier is chosen', async () => {
    const { service, planCreates } = makeService();

    await service.importFromExcel(await buildWorkbook('Viettel'));

    expect(planCreates[0].provider).toBe('viettel');
    expect(planCreates[0].operatorName).toBe('Viettel');
  });

  it('should treat a blank chosen carrier as not chosen', async () => {
    const { service, planCreates } = makeService();

    await service.importFromExcel(await buildWorkbook('iTEL'), '   ');

    expect(planCreates[0].provider).toBe('itel');
  });

  it('should skip the row when neither a carrier nor the column is given', async () => {
    const { service, planCreates } = makeService();

    const result = await service.importFromExcel(await buildWorkbook(null));

    expect(planCreates).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0].error).toBe('Carrier is empty');
  });
});
