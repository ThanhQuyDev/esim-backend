import { Workbook } from 'exceljs';
import {
  PurchaseDeliveryData,
  PurchasedEsim,
  buildPurchaseDeliveryWorkbook,
  installString,
  purchaseDeliveryFilename,
} from './purchase-delivery-workbook';

/**
 * File Excel giao eSIM cho đối tác (#046).
 *
 * Rủi ro được canh ở đây: một mã cài đặt bị Excel làm hỏng, hoặc một ô trống,
 * đều biến thành eSIM đối tác không bán được.
 */
describe('purchase delivery workbook', () => {
  const esim = (over: Partial<PurchasedEsim> = {}): PurchasedEsim => ({
    iccid: '8932042000012345678',
    lpa: 'LPA:1$rsp.truphone.com$ABC-123',
    smdpAddress: 'rsp.truphone.com',
    activationCode: 'ABC-123',
    qrcode: null,
    apnValue: null,
    status: 'active',
    expiresAt: new Date('2027-01-15T00:00:00Z'),
    ...over,
  });

  const data = (
    over: Partial<PurchaseDeliveryData> = {},
  ): PurchaseDeliveryData => ({
    orderNumber: 'PTN-1759000000-ABC123',
    partnerName: 'Công ty TNHH Phân Phối ABC',
    planName: 'Nhật Bản 5GB 7 ngày',
    orderedAt: new Date('2026-10-02T03:00:00Z'),
    quantity: 2,
    unitPriceVnd: 108000,
    totalVnd: 216000,
    esims: [esim(), esim({ iccid: '8932042000087654321' })],
    ...over,
  });

  describe('chuỗi cài đặt', () => {
    it('should dùng LPA nhà cung cấp trả về', () => {
      expect(installString(esim())).toBe('LPA:1$rsp.truphone.com$ABC-123');
    });

    it('should tự ghép khi chỉ có SM-DP+ và activation code', () => {
      // Ô trống ở đây buộc đối tác mở từng eSIM trên web mới bán được hàng.
      expect(installString(esim({ lpa: null }))).toBe(
        'LPA:1$rsp.truphone.com$ABC-123',
      );
      expect(installString(esim({ lpa: '   ' }))).toBe(
        'LPA:1$rsp.truphone.com$ABC-123',
      );
    });

    it('should trả chuỗi rỗng khi thiếu hẳn dữ liệu, không ghép nửa vời', () => {
      expect(installString(esim({ lpa: null, activationCode: null }))).toBe('');
      expect(installString(esim({ lpa: null, smdpAddress: null }))).toBe('');
    });
  });

  describe('nội dung file', () => {
    const read = async (input: PurchaseDeliveryData) => {
      const buffer = await buildPurchaseDeliveryWorkbook(input);
      const wb = new Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      return wb.getWorksheet('eSIM đã mua')!;
    };

    it('should mở đầu bằng mã đơn và thông tin đối tác', async () => {
      const ws = await read(data());
      expect(String(ws.getRow(1).getCell(1).value)).toContain(
        'PTN-1759000000-ABC123',
      );
      expect(String(ws.getRow(2).getCell(2).value)).toBe(
        'Công ty TNHH Phân Phối ABC',
      );
      expect(String(ws.getRow(3).getCell(2).value)).toBe('Nhật Bản 5GB 7 ngày');
    });

    it('should ghi đủ 8 cột theo đúng thứ tự', async () => {
      const ws = await read(data());
      const header = ws.getRow(8);
      expect(String(header.getCell(1).value)).toBe('STT');
      expect(String(header.getCell(2).value)).toBe('ICCID');
      expect(String(header.getCell(3).value)).toBe('Mã cài đặt (LPA)');
      expect(String(header.getCell(6).value)).toBe('APN');
      expect(String(header.getCell(8).value)).toBe('Hạn sử dụng');
    });

    it('should ghi mỗi eSIM một dòng, đánh số từ 1', async () => {
      const ws = await read(data());
      expect(ws.getRow(9).getCell(1).value).toBe(1);
      expect(String(ws.getRow(9).getCell(2).value)).toBe('8932042000012345678');
      expect(ws.getRow(10).getCell(1).value).toBe(2);
      expect(String(ws.getRow(10).getCell(2).value)).toBe(
        '8932042000087654321',
      );
    });

    it('should ép ICCID và mã cài đặt về dạng text', async () => {
      // Không ép thì Excel đổi ICCID 19 chữ số sang 8.93204E+18 và mã hỏng hẳn.
      const ws = await read(data());
      expect(ws.getRow(9).getCell(2).numFmt).toBe('@');
      expect(ws.getRow(9).getCell(3).numFmt).toBe('@');
    });

    it('should không in giá niêm yết của esim.vn vào bảng eSIM', async () => {
      // Đối tác bán theo giá của họ; tờ giao hàng có thể tới tay khách cuối.
      const ws = await read(data());
      const header = ws.getRow(8);
      const titles: string[] = [];
      header.eachCell((cell) => titles.push(String(cell.value)));
      expect(titles.join(' ')).not.toMatch(/niêm yết|bán ra/i);
    });

    it('should nói rõ khi đơn chưa có eSIM thay vì để bảng trống', async () => {
      const ws = await read(data({ esims: [] }));
      expect(String(ws.getRow(9).getCell(1).value)).toContain('chưa có eSIM');
    });

    it('should ghi APN khi gói cần khai tay', async () => {
      const ws = await read(data({ esims: [esim({ apnValue: 'cmhk' })] }));
      expect(String(ws.getRow(9).getCell(6).value)).toBe('cmhk');
    });
  });

  describe('tên file', () => {
    it('should giữ mã đơn và bỏ ký tự không an toàn', () => {
      expect(purchaseDeliveryFilename('PTN-123-ABC')).toBe(
        'esim-PTN-123-ABC.xlsx',
      );
      expect(purchaseDeliveryFilename('PTN/123 ABC')).toBe(
        'esim-PTN-123-ABC.xlsx',
      );
    });
  });
});
