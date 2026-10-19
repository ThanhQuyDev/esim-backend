import { Workbook } from 'exceljs';
import { EsimsImportService } from './esims-import.service';

/**
 * A plan deleted in the CMS kept its slug, so importing its eSIMs again tried
 * to create the plan anew and every row failed on "UQ_plan_slug" — the
 * domestic eSIM tab went empty (19/10). The import brings the plan back.
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

async function buildWorkbook(iccids: string[]): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(HEADERS);
  for (const iccid of iccids) {
    const row: (string | number | null)[] = new Array(HEADERS.length).fill(
      null,
    );
    row[0] = 'Vietnam';
    row[1] = 'VN';
    row[2] = 'MAY79';
    row[3] = 'iTel 3GB / Day';
    row[4] = '3GB';
    row[5] = 30;
    row[6] = 'daily';
    row[8] = 'itel';
    row[19] = iccid;
    sheet.addRow(row);
  }
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function makeService(opts: {
  live: Record<string, unknown> | null;
  owner: Record<string, unknown> | null;
}) {
  let restored = false;
  const esimCreates: Record<string, unknown>[] = [];
  const planRepository = {
    findBySlug: jest.fn(() =>
      Promise.resolve(restored ? opts.owner : opts.live),
    ),
    slugOwner: jest.fn().mockResolvedValue(opts.owner),
    restore: jest.fn(() => {
      restored = true;
      return Promise.resolve();
    }),
  };
  const plansService = {
    create: jest.fn(() => {
      // What the database does when a deleted plan holds the slug.
      throw new Error(
        'duplicate key value violates unique constraint "UQ_plan_slug"',
      );
    }),
    update: jest.fn().mockResolvedValue({}),
    localRetailVnd: jest.fn((cost: number) => Promise.resolve(cost)),
  };
  const esimRepository = {
    findByIccidWithDeleted: jest.fn().mockResolvedValue(null),
    create: jest.fn((payload: Record<string, unknown>) => {
      esimCreates.push(payload);
      return Promise.resolve({ id: esimCreates.length });
    }),
    restore: jest.fn(),
    update: jest.fn(),
  };
  const service = new EsimsImportService(
    esimRepository as never,
    plansService as never,
    planRepository as never,
    {
      findByCountryCode: jest.fn().mockResolvedValue({ id: 5 }),
      findByName: jest.fn(),
    } as never,
  );
  return { service, planRepository, plansService, esimCreates };
}

describe('Importing eSIMs of a plan that was deleted in the CMS', () => {
  const DELETED = {
    id: 32175,
    slug: 'itel-may79',
    destinationId: 5,
    isActive: true,
    deletedAt: new Date('2026-10-19T05:04:54Z'),
  };

  it('should restore the deleted plan and import every row into it', async () => {
    const { service, planRepository, plansService, esimCreates } = makeService({
      live: null,
      owner: DELETED,
    });

    const result = await service.importFromExcel(
      await buildWorkbook(['8406250812014283', '8406250812014284']),
    );

    expect(planRepository.restore).toHaveBeenCalledTimes(1);
    expect(planRepository.restore).toHaveBeenCalledWith(32175);
    expect(plansService.create).not.toHaveBeenCalled();
    expect(result.errors).toEqual([]);
    expect(esimCreates).toHaveLength(2);
    expect(esimCreates.every((e) => e.planId === 32175)).toBe(true);
  });

  it('should put a restored plan that was switched off back on sale', async () => {
    const off = { ...DELETED, isActive: false };
    const { service, plansService } = makeService({ live: null, owner: off });

    await service.importFromExcel(await buildWorkbook(['8406250812014283']));

    expect(plansService.update).toHaveBeenCalledWith(
      32175,
      expect.objectContaining({ isActive: true }),
    );
  });

  it('should still create a plan whose slug nobody holds', async () => {
    const { service, planRepository, plansService } = makeService({
      live: null,
      owner: null,
    });
    plansService.create.mockImplementation((() =>
      Promise.resolve({ id: 7 })) as never);

    await service.importFromExcel(await buildWorkbook(['8406250812014283']));

    expect(planRepository.restore).not.toHaveBeenCalled();
    expect(plansService.create).toHaveBeenCalledTimes(1);
  });
});
