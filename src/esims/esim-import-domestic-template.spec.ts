import { Workbook } from 'exceljs';
import { EsimsImportService } from './esims-import.service';

/**
 * #066 (test round 4) — the domestic eSIM import template.
 *
 * It differs from the travel template: a Vietnamese title row sits above the
 * English one, there is no "Days"/"Type" column (a plan runs for monthly
 * cycles), prices are formulas, one file mixes several carriers, and red
 * columns carry the plan's perks (minutes by network, first-cycle data…).
 */

const VI = [
  'Country',
  'Country Code',
  'Plan ID',
  'Name',
  'Data chu kỳ đầu tiên',
  'Data chu kỳ tiếp theo',
  'Cách tính data',
  'Loại gói',
  'Phút gọi ngoại mạng',
  'Phút gọi nội mạng',
  'Phút gọi trong nước',
  'SMS ngoại mạng',
  'SMS nội mạng',
  'Miễn phí data mạng xã hội',
  'Giá gói cước theo mỗi chu kỳ',
  'Số lượng chu kỳ sử dụng (tính theo tháng)',
  'Expried Time',
  'Carrier',
  'Network',
  'Throttled Speed',
  'APN',
  'IP',
  'Topup',
  'eKYC',
  'Hot-Spot',
  'Hot-Spot Allow',
  'Support Phone Number',
  'ICCID',
  'Phone Number',
  'LPA',
  'Cost Price',
  'Sell Price',
];
const EN = [
  'Country',
  'Country Code',
  'Plan ID',
  'Name',
  '1st Cycle Data',
  'Recurring Data',
  'Data Period',
  'Bundle Type',
  'Off-net Minutes',
  'On-net Minutes',
  'Domestic Minutes',
  'Off-net SMS',
  'On-net SMS',
  'Zero-Rated Social Data',
  'Cycle Fee',
  'No. of Cycles',
  'Expried Time',
  'Carrier',
  'Network',
  'Throttled Speed',
  'APN',
  'IP',
  'Topup',
  'eKYC',
  'Hot-Spot',
  'Hot-Spot Allow',
  'Support Phone Number',
  'ICCID',
  'Phone Number',
  'LPA',
  'Cost Price',
  'Sell Price',
];

type Line = Partial<Record<(typeof EN)[number], unknown>>;

async function buildWorkbook(lines: Line[], withVietnameseRow = true) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  if (withVietnameseRow) sheet.addRow(VI);
  sheet.addRow(EN);
  for (const line of lines) {
    sheet.addRow(EN.map((h) => (h in line ? line[h] : null)));
  }
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

const base: Line = {
  Country: 'Vietnam',
  'Country Code': 'VN',
  'Expried Time': '31/12/2026',
  Network: '4G',
  'Throttled Speed': '0 Kbps',
  IP: 'VN',
  Topup: 'Có',
  eKYC: 'Có',
  'Hot-Spot': 'Có',
};

function makeService(
  existingPlan: Record<string, unknown> | null = null,
  existingEsim: Record<string, unknown> | null = null,
) {
  const planCreates: Record<string, unknown>[] = [];
  const planUpdates: Record<string, unknown>[] = [];
  const esimCreates: Record<string, unknown>[] = [];
  const service = new EsimsImportService(
    {
      findByIccidWithDeleted: jest.fn().mockResolvedValue(existingEsim),
      create: jest.fn((payload: Record<string, unknown>) => {
        esimCreates.push(payload);
        return Promise.resolve({ id: 1 });
      }),
      restore: jest.fn(),
      update: jest.fn(),
    } as never,
    {
      create: jest.fn((payload: Record<string, unknown>) => {
        planCreates.push(payload);
        return Promise.resolve({ id: planCreates.length });
      }),
      update: jest.fn((_id: unknown, payload: Record<string, unknown>) => {
        planUpdates.push(payload);
        return Promise.resolve(payload);
      }),
      localRetailVnd: jest.fn((cost: number) => Promise.resolve(cost)),
    } as never,
    {
      findBySlug: jest.fn().mockResolvedValue(existingPlan),
      slugOwner: jest.fn().mockResolvedValue(null),
    } as never,
    {
      findByCountryCode: jest.fn().mockResolvedValue({ id: 5 }),
      findByName: jest.fn().mockResolvedValue(null),
    } as never,
  );
  return { service, planCreates, planUpdates, esimCreates };
}

describe('Nhập eSIM nội địa theo file mẫu mới (#066)', () => {
  it('should read the English header under the Vietnamese one and import every eSIM', async () => {
    const { service, esimCreates } = makeService();
    const result = await service.importFromExcel(
      await buildWorkbook([
        {
          ...base,
          'Plan ID': 'MAY79',
          Name: 'iTel MAY79',
          '1st Cycle Data': '3 GB',
          'Data Period': 'Daily',
          'Bundle Type': 'Daily',
          'No. of Cycles': 1,
          Carrier: 'iTel',
          ICCID: '8984000000000000001',
          'Cost Price': 179000,
          'Sell Price': 479000,
        },
        {
          ...base,
          'Plan ID': 'MAY79',
          Name: 'iTel MAY79',
          '1st Cycle Data': '3 GB',
          'Data Period': 'Daily',
          'Bundle Type': 'Daily',
          'No. of Cycles': 1,
          Carrier: 'iTel',
          ICCID: '8984000000000000002',
          'Cost Price': 179000,
          'Sell Price': 479000,
        },
      ]),
      undefined,
      undefined,
      undefined,
      'domestic',
    );

    // Before: row 2 (the English titles) was imported as an eSIM "ICCID".
    expect(result.errors).toEqual([]);
    expect(result.total).toBe(2);
    expect(esimCreates.map((e) => e.iccid)).toEqual([
      '8984000000000000001',
      '8984000000000000002',
    ]);
  });

  it('should also accept the file with only the English title row', async () => {
    const { service, esimCreates } = makeService();
    await service.importFromExcel(
      await buildWorkbook(
        [
          {
            ...base,
            'Plan ID': 'X1',
            '1st Cycle Data': '1 GB',
            'No. of Cycles': 1,
            Carrier: 'iTel',
            ICCID: '8984000000000000009',
            'Cost Price': 100000,
          },
        ],
        false,
      ),
      undefined,
      undefined,
      undefined,
      'domestic',
    );
    expect(esimCreates).toHaveLength(1);
  });

  it('should store the plan perks and work out its length from the cycles', async () => {
    const { service, planCreates } = makeService();
    await service.importFromExcel(
      await buildWorkbook([
        {
          ...base,
          'Plan ID': '5G109C',
          Name: 'VNSKY 5G109C 7GB / Day',
          '1st Cycle Data': '7 GB',
          'Recurring Data': '4 GB',
          'Data Period': 'Daily',
          'Bundle Type': 'Daily',
          'Off-net Minutes': 30,
          'On-net Minutes': 500,
          'Domestic Minutes': 0,
          'Off-net SMS': 0,
          'Zero-Rated Social Data': 'Không',
          'Cycle Fee': 109000,
          'No. of Cycles': 12,
          Carrier: 'VNSKY',
          'Hot-Spot Allow': '7 GB',
          'Support Phone Number': 'Đầu số 077',
          ICCID: '8984000000000000003',
          // Prices are formulas in the template; their cached result counts.
          'Cost Price': { formula: 'O2*P2+100000', result: 1408000 },
          'Sell Price': { formula: 'AE2+300000', result: 1708000 },
        },
      ]),
      undefined,
      undefined,
      undefined,
      'domestic',
    );

    const plan = planCreates[0];
    expect(plan.durationDays).toBe(360);
    expect(plan.dataMb).toBe(7 * 1024);
    expect(plan.type).toBe('daily');
    expect(plan.costPrice).toBe(1408000);
    expect(plan.retailPrice).toBe(1708000);
    expect(plan.call).toBe(1);
    expect(plan.ipExport).toBe('VN');
    expect(plan.domesticOffer).toEqual({
      firstCycleDataMb: 7 * 1024,
      recurringDataMb: 4 * 1024,
      dataPeriod: 'daily',
      bundleType: 'daily',
      offNetMinutes: 30,
      onNetMinutes: 500,
      domesticMinutes: 0,
      offNetSms: 0,
      onNetSms: 0,
      zeroRatedSocial: false,
      cycleFeeVnd: 109000,
      cycleMonths: 12,
      supportPhone: 'Đầu số 077',
    });
  });

  it('should read unlimited and zero-rated plans', async () => {
    const { service, planCreates } = makeService();
    await service.importFromExcel(
      await buildWorkbook([
        {
          ...base,
          'Plan ID': 'WIN99X',
          '1st Cycle Data': 'Unlimited',
          'Recurring Data': 'Unlimited',
          'Data Period': 'Month',
          'Bundle Type': 'Unlimited',
          'No. of Cycles': 1,
          Carrier: 'Wintel',
          ICCID: '8984000000000000004',
          'Cost Price': 199000,
        },
        {
          ...base,
          'Plan ID': 'MAY89S',
          '1st Cycle Data': '1 GB',
          'Data Period': 'Daily',
          'Bundle Type': 'Unlimited-reduce',
          'Zero-Rated Social Data': 'Có',
          'Domestic Minutes': 10,
          'No. of Cycles': 1,
          Carrier: 'iTel',
          ICCID: '8984000000000000005',
          'Cost Price': 189000,
        },
      ]),
      undefined,
      undefined,
      undefined,
      'domestic',
    );

    const [unlimited, reduce] = planCreates;
    expect(unlimited.type).toBe('unlimited');
    expect((unlimited.domesticOffer as any).firstCycleDataMb).toBeNull();
    expect((unlimited.domesticOffer as any).dataPeriod).toBe('month');
    expect(reduce.type).toBe('unlimited-reduce');
    expect((reduce.domesticOffer as any).zeroRatedSocial).toBe(true);
    expect((reduce.domesticOffer as any).domesticMinutes).toBe(10);
    // Blank recurring data = same as the first cycle.
    expect((reduce.domesticOffer as any).recurringDataMb).toBe(1024);
  });

  it("should file each row under its own carrier, not the dialog's", async () => {
    // One template lists iTel, Wintel and VNSKY together.
    const { service, planCreates } = makeService();
    await service.importFromExcel(
      await buildWorkbook([
        {
          ...base,
          'Plan ID': 'A',
          '1st Cycle Data': '1 GB',
          'No. of Cycles': 1,
          Carrier: 'iTel',
          ICCID: '8984000000000000006',
          'Cost Price': 1,
        },
        {
          ...base,
          'Plan ID': 'B',
          '1st Cycle Data': '1 GB',
          'No. of Cycles': 1,
          Carrier: 'Wintel',
          ICCID: '8984000000000000007',
          'Cost Price': 1,
        },
      ]),
      'iTel',
      undefined,
      undefined,
      'domestic',
    );
    expect(planCreates.map((p) => p.provider)).toEqual(['itel', 'wintel']);
  });

  it('should refresh the perks of an existing plan on re-upload', async () => {
    const { service, planUpdates } = makeService({
      id: 7,
      costPrice: 179000,
      retailPrice: 479000,
      isLocalInventory: true,
      isDomesticEsim: true,
      domesticOffer: null,
      ipExport: 'VN',
    });
    await service.importFromExcel(
      await buildWorkbook([
        {
          ...base,
          'Plan ID': 'MAY79',
          '1st Cycle Data': '3 GB',
          'Data Period': 'Daily',
          'Bundle Type': 'Daily',
          'On-net Minutes': 500,
          'No. of Cycles': 1,
          Carrier: 'iTel',
          ICCID: '8984000000000000008',
          'Cost Price': 179000,
          'Sell Price': 479000,
        },
      ]),
      undefined,
      undefined,
      undefined,
      'domestic',
    );
    expect(planUpdates).toHaveLength(1);
    expect((planUpdates[0].domesticOffer as any).onNetMinutes).toBe(500);
  });

  it('should still update the plan from a row whose eSIM is already in stock', async () => {
    // The tester's file re-lists eSIMs imported earlier with the old template:
    // their rows were skipped before the plan, so the plan kept its old price
    // and never got its perks.
    const { service, planUpdates, esimCreates } = makeService(
      {
        id: 7,
        costPrice: 198000,
        retailPrice: 297000,
        isLocalInventory: true,
        isDomesticEsim: true,
        domesticOffer: null,
        ipExport: null,
      },
      { id: 3, deletedAt: null },
    );
    const result = await service.importFromExcel(
      await buildWorkbook([
        {
          ...base,
          'Plan ID': 'MAY79',
          '1st Cycle Data': '3 GB',
          'Data Period': 'Daily',
          'Bundle Type': 'Daily',
          'No. of Cycles': 1,
          Carrier: 'iTel',
          ICCID: '8984000000000000010',
          'Cost Price': 179000,
          'Sell Price': 479000,
        },
      ]),
      undefined,
      undefined,
      undefined,
      'domestic',
    );
    expect(esimCreates).toHaveLength(0);
    expect(result.errors[0].error).toBe('ICCID already exists');
    expect(planUpdates).toHaveLength(1);
    expect(planUpdates[0].costPrice).toBe(179000);
    expect(planUpdates[0].domesticOffer).toBeTruthy();
    expect(result.planUpdated).toBe(1);
  });

  it('should reshape a plan first imported with the old template', async () => {
    const { service, planUpdates } = makeService({
      id: 8,
      type: 'daily',
      durationDays: 30,
      dataMb: 2048,
      costPrice: 129000,
      retailPrice: 0,
      isLocalInventory: true,
      isDomesticEsim: true,
      domesticOffer: null,
    });
    await service.importFromExcel(
      await buildWorkbook([
        {
          ...base,
          'Plan ID': 'MAY35S',
          '1st Cycle Data': '10 GB',
          'Data Period': 'Month',
          'Bundle Type': 'Month',
          'No. of Cycles': 12,
          Carrier: 'iTel',
          ICCID: '8984000000000000011',
          'Cost Price': 10036000,
        },
      ]),
      undefined,
      undefined,
      undefined,
      'domestic',
    );
    expect(planUpdates[0]).toMatchObject({
      type: 'month',
      durationDays: 360,
      dataMb: 10240,
      costPrice: 10036000,
    });
  });
});
