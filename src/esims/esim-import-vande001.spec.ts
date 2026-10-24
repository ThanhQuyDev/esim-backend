import { Workbook } from 'exceljs';
import { EsimsImportService } from './esims-import.service';
import {
  carrierOf,
  domesticProviderOf,
  esimKindFromType,
} from '../plans/domestic-provider';
import { planRefundSupported } from '../partners/partner-purchase';

/**
 * eSIM nội địa — các file mẫu 2026-10 (vande #001).
 *
 * - Cột "eSIM Type" (Local / Travel) quyết định loại eSIM của từng dòng, thắng
 *   nút admin bấm.
 * - Gói nội địa thuộc nhà cung cấp riêng "<nhà mạng>-noidia".
 * - Nhập lại một file làm mới tên gói (và các mô tả khác), không chỉ giá.
 * - eSIM chưa bán đang nằm ở gói khác thì chuyển sang gói của dòng đó; gói cũ
 *   hết hàng thì ngừng bán.
 * - File du lịch Viettel mới (có "Bundle Type") không bị đọc thành file nội địa.
 */

const TRAVEL_HEADERS = [
  'Country',
  'Country Code',
  'eSIM Type',
  'Plan ID',
  'Name',
  'Data',
  'Days',
  'Bundle Type',
  'Expried Time',
  'Carrier',
  'Network',
  'Roaming',
  'IP',
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
  'Cost Price',
  'Sell Price',
];

type Row = Partial<Record<(typeof TRAVEL_HEADERS)[number], unknown>>;

async function buildTravelFile(rows: Row[]): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(TRAVEL_HEADERS);
  for (const r of rows) {
    sheet.addRow(TRAVEL_HEADERS.map((h) => r[h] ?? null));
  }
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

const VIETTEL_ROW: Row = {
  Country: 'Vietnam',
  'Country Code': 'VN',
  'eSIM Type': 'Travel',
  'Plan ID': '150M',
  Name: 'Viettel - Daily 5 GB/day - 30 days',
  Data: '5 GB',
  Days: 30,
  'Bundle Type': 'Daily',
  'Expried Time': '25/12/2026',
  Carrier: 'Viettel',
  Network: '5G',
  Roaming: 'Không',
  IP: 'VN',
  'Throttled Speed': 'Terminate',
  APN: 'v-internet',
  Topup: 'Không',
  eKYC: 'Không',
  'Hot-Spot': 'Có',
  'Hot-Spot Allow': '5GB',
  ICCID: '8984048000978915837',
  LPA: 'LPA:1$smdp.example$CODE',
  'Cost Price': 195000,
  'Sell Price': 440000,
};

function makeService(opts: {
  existingPlan?: Record<string, unknown> | null;
  existingEsim?: Record<string, unknown> | null;
  stockLeft?: unknown[];
  oldPlan?: Record<string, unknown> | null;
}) {
  const planCreates: Record<string, unknown>[] = [];
  const planUpdates: { id: unknown; patch: Record<string, unknown> }[] = [];
  const esimUpdates: { id: unknown; patch: Record<string, unknown> }[] = [];
  const esimCreates: Record<string, unknown>[] = [];

  const service = new EsimsImportService(
    {
      findByIccidWithDeleted: jest
        .fn()
        .mockResolvedValue(opts.existingEsim ?? null),
      create: jest.fn((payload: Record<string, unknown>) => {
        esimCreates.push(payload);
        return Promise.resolve({ id: 1 });
      }),
      restore: jest.fn().mockResolvedValue(undefined),
      update: jest.fn((id: unknown, patch: Record<string, unknown>) => {
        esimUpdates.push({ id, patch });
        return Promise.resolve({ id });
      }),
      findAvailableByPlanId: jest.fn().mockResolvedValue(opts.stockLeft ?? []),
    } as never,
    {
      create: jest.fn((payload: Record<string, unknown>) => {
        planCreates.push(payload);
        return Promise.resolve({ id: 99 });
      }),
      update: jest.fn((id: unknown, patch: Record<string, unknown>) => {
        planUpdates.push({ id, patch });
        return Promise.resolve(patch);
      }),
      localRetailVnd: jest.fn((cost: number) => Promise.resolve(cost + 20000)),
    } as never,
    {
      findBySlug: jest.fn().mockResolvedValue(opts.existingPlan ?? null),
      slugOwner: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(opts.oldPlan ?? null),
      update: jest.fn(),
    } as never,
    {
      findByCountryCode: jest.fn().mockResolvedValue({ id: 5 }),
      findByName: jest.fn().mockResolvedValue(null),
    } as never,
  );

  return { service, planCreates, planUpdates, esimUpdates, esimCreates };
}

describe('eSIM nội địa — file mẫu 2026-10 (vande #001)', () => {
  describe('mã nhà cung cấp nội địa', () => {
    it('should add and strip the -noidia suffix', () => {
      expect(domesticProviderOf('itel')).toBe('itel-noidia');
      expect(domesticProviderOf('itel-noidia')).toBe('itel-noidia');
      expect(carrierOf('itel-noidia')).toBe('itel');
      expect(carrierOf('viettel')).toBe('viettel');
    });

    it('should read the eSIM Type column', () => {
      expect(esimKindFromType('Local')).toBe('domestic');
      expect(esimKindFromType(' travel ')).toBe('travel');
      expect(esimKindFromType('')).toBeNull();
      expect(esimKindFromType(null)).toBeNull();
    });

    it('should never refund a domestic eSIM bought by a partner', () => {
      expect(planRefundSupported({ provider: 'itel-noidia', name: 'x' })).toBe(
        false,
      );
    });
  });

  it('should let eSIM Type = Local win over the travel button', async () => {
    const { service, planCreates } = makeService({});

    await service.importFromExcel(
      await buildTravelFile([
        { ...VIETTEL_ROW, 'eSIM Type': 'Local', 'Plan ID': '5G135N' },
      ]),
      undefined,
      undefined,
      undefined,
      'travel',
    );

    expect(planCreates).toHaveLength(1);
    expect(planCreates[0].provider).toBe('viettel-noidia');
    expect(planCreates[0].slug).toBe('viettel-noidia-5g135n');
    expect(planCreates[0].isDomesticEsim).toBe(true);
  });

  it('should let eSIM Type = Travel win over the domestic button', async () => {
    const { service, planCreates } = makeService({});

    await service.importFromExcel(
      await buildTravelFile([VIETTEL_ROW]),
      'Viettel',
      undefined,
      undefined,
      'domestic',
    );

    expect(planCreates[0].provider).toBe('viettel');
    expect(planCreates[0].isDomesticEsim).toBe(false);
  });

  it('should read the new Viettel travel file as travel, with its Bundle Type and Days', async () => {
    const { service, planCreates } = makeService({});

    await service.importFromExcel(await buildTravelFile([VIETTEL_ROW]));

    expect(planCreates[0]).toMatchObject({
      type: 'daily',
      durationDays: 30,
      dataMb: 5120,
      domesticOffer: null,
      name: 'Viettel - Daily 5 GB/day - 30 days',
      apn: 'v-internet',
      ipExport: 'VN',
    });
  });

  it('should rename a plan whose stored name is stale', async () => {
    const { service, planUpdates } = makeService({
      existingPlan: {
        id: 7,
        slug: 'viettel-150m',
        destinationId: 5,
        costPrice: 195000,
        retailPrice: 440000,
        isDomesticEsim: false,
        isLocalInventory: true,
        name: 'Viettel 5GB / Day - 30Days',
        operatorName: 'Viettel',
        type: 'daily',
        durationDays: 30,
        dataMb: 5120,
        apn: 'v-internet',
      },
    });

    await service.importFromExcel(await buildTravelFile([VIETTEL_ROW]));

    expect(planUpdates).toHaveLength(1);
    expect(planUpdates[0].patch.name).toBe(
      'Viettel - Daily 5 GB/day - 30 days',
    );
    // Prices unchanged: not counted as a price update.
    expect(planUpdates[0].patch.costPrice).toBeUndefined();
  });

  it('should move an unsold eSIM to its new plan and take the empty old plan off sale', async () => {
    const { service, esimUpdates, planUpdates, esimCreates } = makeService({
      existingPlan: null,
      existingEsim: {
        id: 300,
        iccid: VIETTEL_ROW.ICCID,
        planId: 41,
        status: 'available',
        orderItemId: null,
        deletedAt: null,
        dataTotal: '5120',
        expiresAt: null,
      },
      stockLeft: [],
      oldPlan: {
        id: 41,
        slug: 'viettel-5g135n',
        isLocalInventory: true,
        isActive: true,
      },
    });

    const result = await service.importFromExcel(
      await buildTravelFile([
        { ...VIETTEL_ROW, 'eSIM Type': 'Local', 'Plan ID': '5G135N' },
      ]),
    );

    expect(result.esimMoved).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(esimCreates).toHaveLength(0);
    expect(esimUpdates[0]).toMatchObject({
      id: 300,
      patch: { planId: 99, provider: 'viettel-noidia' },
    });
    expect(planUpdates).toContainEqual({ id: 41, patch: { isActive: false } });
  });

  it('should leave a sold eSIM where it is', async () => {
    const { service, esimUpdates } = makeService({
      existingEsim: {
        id: 301,
        iccid: VIETTEL_ROW.ICCID,
        planId: 41,
        status: 'sold',
        orderItemId: 12,
        deletedAt: null,
      },
    });

    const result = await service.importFromExcel(
      await buildTravelFile([{ ...VIETTEL_ROW, 'eSIM Type': 'Local' }]),
    );

    expect(esimUpdates).toHaveLength(0);
    expect(result.errors[0].error).toBe('ICCID already exists');
  });
});
