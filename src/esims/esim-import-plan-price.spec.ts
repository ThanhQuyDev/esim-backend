import { Workbook } from 'exceljs';
import { EsimsImportService } from './esims-import.service';

/**
 * Uploading the eSIM file again with new prices has to actually change the
 * plan. It used to only create the plan on the FIRST upload; later uploads
 * backfilled the destination and threw the prices away, so a plan kept selling
 * at its original cost no matter what the file said.
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

/** One-row workbook; `costPrice`/`sellPrice` may be left blank. */
async function buildWorkbook(opts: {
  iccid: string;
  costPrice?: number | null;
  sellPrice?: number | null;
}): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(HEADERS);
  const row: (string | number | null)[] = new Array(HEADERS.length).fill(null);
  row[0] = 'Vietnam';
  row[1] = 'VN';
  row[2] = 'WIN69';
  row[3] = 'Wintel 69K';
  row[4] = '3GB';
  row[5] = 30;
  row[6] = 'fixed';
  row[8] = 'wintel';
  row[19] = opts.iccid;
  row[24] = opts.costPrice ?? null;
  row[25] = opts.sellPrice ?? null;
  sheet.addRow(row);

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function makeService(existingPlan: Record<string, unknown> | null) {
  const planUpdates: Record<string, unknown>[] = [];
  const planCreates: Record<string, unknown>[] = [];

  const esimRepository = {
    findByIccidWithDeleted: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    restore: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const plansService = {
    create: jest.fn((payload: Record<string, unknown>) => {
      planCreates.push(payload);
      return Promise.resolve({ id: 99 });
    }),
  };
  const planRepository = {
    findBySlug: jest.fn().mockResolvedValue(existingPlan),
    update: jest.fn((_id: unknown, payload: Record<string, unknown>) => {
      planUpdates.push(payload);
      return Promise.resolve(payload);
    }),
  };
  const destinationsService = {
    findByCountryCode: jest.fn().mockResolvedValue({ id: 5 }),
    findByName: jest.fn().mockResolvedValue(null),
  };

  const service = new EsimsImportService(
    esimRepository as never,
    plansService as never,
    planRepository as never,
    destinationsService as never,
  );

  return { service, planUpdates, planCreates };
}

const EXISTING_PLAN = {
  id: 99,
  destinationId: 5,
  costPrice: 69000,
  retailPrice: 89000,
};

describe('Re-uploading the eSIM file with new prices', () => {
  it('should update an existing plan to the price in the file', async () => {
    const { service, planUpdates } = makeService(EXISTING_PLAN);

    const buffer = await buildWorkbook({
      iccid: '8934079000000000001',
      costPrice: 75000,
      sellPrice: 99000,
    });
    const result = await service.importFromExcel(buffer);

    expect(planUpdates).toHaveLength(1);
    expect(planUpdates[0].costPrice).toBe(75000);
    expect(planUpdates[0].retailPrice).toBe(99000);
    // Import stores cost as the base price; margin tiers are applied later.
    expect(planUpdates[0].price).toBe(75000);
    expect(planUpdates[0].vndPrice).toBe(75000);
    expect(result.planUpdated).toBe(1);
  });

  it('should not touch the plan when the prices are unchanged', async () => {
    const { service, planUpdates } = makeService(EXISTING_PLAN);

    const buffer = await buildWorkbook({
      iccid: '8934079000000000002',
      costPrice: 69000,
      sellPrice: 89000,
    });
    const result = await service.importFromExcel(buffer);

    expect(planUpdates).toHaveLength(0);
    expect(result.planUpdated).toBe(0);
  });

  it('should keep the existing price when the file leaves the cell blank', async () => {
    const { service, planUpdates } = makeService(EXISTING_PLAN);

    // A blank price column means "not supplied", never "free".
    const buffer = await buildWorkbook({ iccid: '8934079000000000003' });
    const result = await service.importFromExcel(buffer);

    expect(planUpdates).toHaveLength(0);
    expect(result.planUpdated).toBe(0);
  });

  it('should still create the plan with its prices on the first upload', async () => {
    const { service, planCreates } = makeService(null);

    const buffer = await buildWorkbook({
      iccid: '8934079000000000004',
      costPrice: 69000,
      sellPrice: 89000,
    });
    const result = await service.importFromExcel(buffer);

    expect(planCreates).toHaveLength(1);
    expect(planCreates[0].costPrice).toBe(69000);
    expect(planCreates[0].retailPrice).toBe(89000);
    expect(result.planCreated).toBe(1);
    expect(result.planUpdated).toBe(0);
  });
});
