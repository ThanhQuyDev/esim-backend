import { Workbook } from 'exceljs';
import { EsimsImportService } from './esims-import.service';

/**
 * Hai nút nhập riêng cho hai loại eSIM của nhà mạng trong nước.
 *
 * eSIM nội địa (Wintel / iTEL / VNSKY) và eSIM du lịch của nhà mạng Việt Nam
 * (Viettel) dùng chung một file mẫu và một endpoint, nên thứ duy nhất phân biệt
 * chúng là `esimKind` do người dùng chọn. Nhầm chỗ này thì gói nằm sai tab:
 * khách tìm eSIM nội địa lại thấy gói đi nước ngoài, hoặc ngược lại.
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

async function buildWorkbook(carrier: string): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(HEADERS);
  const row: (string | number | null)[] = new Array(HEADERS.length).fill(null);
  row[0] = 'Vietnam';
  row[1] = 'VN';
  row[2] = 'PLAN1';
  row[3] = `${carrier} 5GB`;
  row[4] = '5GB';
  row[5] = 30;
  row[6] = 'daily';
  row[8] = carrier;
  row[19] = '8934079000000000009';
  row[24] = 100000;
  row[25] = 150000;
  sheet.addRow(row);
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function makeService(existingPlan: Record<string, unknown> | null = null) {
  const planCreates: Record<string, unknown>[] = [];
  const planUpdates: Record<string, unknown>[] = [];

  const service = new EsimsImportService(
    {
      findByIccidWithDeleted: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      restore: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue({ id: 1 }),
    } as never,
    {
      create: jest.fn((payload: Record<string, unknown>) => {
        planCreates.push(payload);
        return Promise.resolve({ id: 99 });
      }),
      update: jest.fn((_id: unknown, payload: Record<string, unknown>) => {
        planUpdates.push(payload);
        return Promise.resolve(payload);
      }),
      localRetailVnd: jest.fn((cost: number) => Promise.resolve(cost + 20000)),
    } as never,
    {
      findBySlug: jest.fn().mockResolvedValue(existingPlan),
      update: jest.fn(),
    } as never,
    {
      findByCountryCode: jest.fn().mockResolvedValue({ id: 5 }),
      findByName: jest.fn().mockResolvedValue(null),
    } as never,
  );

  return { service, planCreates, planUpdates };
}

describe('Nhập eSIM: phân biệt nội địa và du lịch', () => {
  describe('gói tạo mới', () => {
    it('should mark a plan as eSIM nội địa when imported with kind=domestic', async () => {
      const { service, planCreates } = makeService();

      await service.importFromExcel(
        await buildWorkbook('wintel'),
        'Wintel',
        undefined,
        undefined,
        'domestic',
      );

      expect(planCreates[0].isDomesticEsim).toBe(true);
      // Vẫn là hàng mình giữ, giá VND — cờ này không được mất.
      expect(planCreates[0].isLocalInventory).toBe(true);
    });

    it('should leave a travel plan out of the domestic tab', async () => {
      const { service, planCreates } = makeService();

      await service.importFromExcel(
        await buildWorkbook('viettel'),
        'Viettel',
        undefined,
        undefined,
        'travel',
      );

      expect(planCreates[0].isDomesticEsim).toBe(false);
      expect(planCreates[0].isLocalInventory).toBe(true);
    });

    it('should default to travel when no kind is given', async () => {
      // Loại du lịch là loại đã tồn tại từ trước. Một lệnh nhập cũ không được
      // tự nhiên biến hàng của mình thành eSIM nội địa.
      const { service, planCreates } = makeService();

      await service.importFromExcel(await buildWorkbook('viettel'), 'Viettel');

      expect(planCreates[0].isDomesticEsim).toBe(false);
    });
  });

  describe('gói đã tồn tại', () => {
    it('should move a mis-filed plan when re-imported with the other button', async () => {
      // Nhập lại bằng nút còn lại là cách duy nhất người dùng tự sửa được phân
      // loại sai mà không phải vào database.
      const { service, planUpdates } = makeService({
        id: 99,
        destinationId: 5,
        costPrice: 100000,
        retailPrice: 150000,
        isDomesticEsim: false,
      });

      await service.importFromExcel(
        await buildWorkbook('wintel'),
        'Wintel',
        undefined,
        undefined,
        'domestic',
      );

      expect(planUpdates[0].isDomesticEsim).toBe(true);
    });

    it('should not write a patch when the kind already matches', async () => {
      // `isDomesticEsim` chưa có giá trị phải đọc là false, nếu không mọi lần
      // nhập loại travel đều sinh một patch rỗng nghĩa.
      const { service, planUpdates } = makeService({
        id: 99,
        destinationId: 5,
        costPrice: 100000,
        retailPrice: 150000,
      });

      await service.importFromExcel(
        await buildWorkbook('viettel'),
        'Viettel',
        undefined,
        undefined,
        'travel',
      );

      expect(planUpdates).toHaveLength(0);
    });
  });
});
