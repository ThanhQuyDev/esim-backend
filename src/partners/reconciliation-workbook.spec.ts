import { Workbook } from 'exceljs';
import {
  buildReconciliationWorkbook,
  ReconciliationWorkbookData,
} from './reconciliation-workbook';

/**
 * File .xlsx đính kèm email đối soát (#006).
 *
 * Đây là văn bản hai bên ký, nên điều đáng bảo vệ nhất là các con số trong đó
 * nhất quán với nhau: dòng chữ phải khớp dòng số, và tổng ở sheet "Chi tiết giao
 * dịch" phải khớp mục I của biên bản. Chính file mẫu được gửi kèm đã sai điểm
 * thứ nhất (số 1.081.691 nhưng chữ đọc là "một triệu sáu trăm năm mươi nghìn").
 */
describe('file đối soát đính kèm', () => {
  const base = (): ReconciliationWorkbookData => ({
    partyA: {
      name: 'CÔNG TY TNHH VIỄN THÔNG ESIM',
      address: '331/21 Vườn Lài, Phường Phú Thọ Hòa, Thành Phố Hồ Chí Minh',
      taxCode: '0318081642',
      representative: 'Bà Lại Thị Hà',
      position: 'Giám Đốc',
    },
    partyB: {
      name: 'CÔNG TY CỔ PHẦN MOBICAST',
      address: 'Tầng 4, Tòa nhà Trung Tâm Quốc Tế, 17 Ngô Quyền, Hà Nội',
      taxCode: '0107591436',
      representative: 'Ông Trần Hoàng Vũ',
      position: '',
    },
    periodStart: new Date(2026, 7, 1),
    periodEnd: new Date(2026, 7, 31),
    issuedAt: new Date(2026, 8, 4),
    contractLines: [
      'Căn cứ Hợp đồng đại lý ủy quyền phân phối sản phẩm, dịch vụ viễn thông số 012025/HĐĐL–MOBICAST–ESIM',
    ],
    commissionVnd: 1_500_000,
    vatPercent: 10,
    transactions: [
      {
        orderNumber: 'ORD-260805120000001-ABC123',
        products: 'Ukraine unlimited x2',
        revenueVnd: 900_000,
        source: 'Link - EOKIC5TO',
        customer: 'Khách mới',
        esims: 2,
        commissionPercent: 15,
        commissionVnd: 900_000,
        status: 'Đã duyệt',
        createdAt: new Date(2026, 7, 5),
      },
      {
        orderNumber: 'ORD-260812090000002-DEF456',
        products: 'Viettel 5GB / Day - 7Days',
        revenueVnd: 600_000,
        source: 'Mã - ESIMAF',
        customer: 'Khách quay lại',
        esims: 1,
        commissionPercent: 15,
        commissionVnd: 600_000,
        status: 'Chờ xác nhận',
        createdAt: new Date(2026, 7, 12),
      },
    ],
  });

  const openWorkbook = async (data: ReconciliationWorkbookData) => {
    const buffer = await buildReconciliationWorkbook(data);
    const wb = new Workbook();
    await wb.xlsx.load(buffer as never);
    return wb;
  };

  /** Mọi chữ trong một sheet, để tìm một câu mà không phụ thuộc vị trí ô. */
  const sheetText = (wb: Workbook, name: string): string => {
    const sheet = wb.getWorksheet(name)!;
    const parts: string[] = [];
    sheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        parts.push(String(cell.value ?? ''));
      });
    });
    return parts.join(' | ');
  };

  it('should có đúng 2 sheet, đặt tên như mô tả', async () => {
    const wb = await openWorkbook(base());

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Đối soát',
      'Chi tiết giao dịch',
    ]);
  });

  it('should điền thông tin hai bên và kỳ đối soát', async () => {
    const text = sheetText(await openWorkbook(base()), 'Đối soát');

    expect(text).toContain('Bên A: CÔNG TY TNHH VIỄN THÔNG ESIM');
    expect(text).toContain('Bên B: CÔNG TY CỔ PHẦN MOBICAST');
    expect(text).toContain('MST: 0107591436');
    expect(text).toContain('Từ ngày 01/08/2026 đến ngày 31/08/2026');
    expect(text).toContain('Hôm nay ngày 04/09/2026');
  });

  it('should tính VAT và tổng tiền từ hoa hồng', async () => {
    const wb = await openWorkbook(base());
    const text = sheetText(wb, 'Đối soát');

    expect(text).toContain('Chia sẻ doanh thu bán hàng tháng 08/2026');
    expect(text).toContain('Thuế VAT (10%)');
    // 1.500.000 + 10% = 1.650.000
    const sheet = wb.getWorksheet('Đối soát')!;
    const amounts: number[] = [];
    sheet.eachRow((row) => {
      const v = row.getCell(6).value;
      if (typeof v === 'number') amounts.push(v);
    });
    expect(amounts).toContain(1_500_000);
    expect(amounts).toContain(150_000);
    expect(amounts).toContain(1_650_000);
  });

  it('should để dòng "Bằng chữ" khớp với số tiền', async () => {
    // Lỗi có thật trong file mẫu: số một đằng, chữ một nẻo.
    const text = sheetText(await openWorkbook(base()), 'Đối soát');

    expect(text).toContain('Bằng chữ: Một triệu sáu trăm năm mươi nghìn đồng');
    expect(text).not.toContain('1,081,691');
  });

  it('should để số phải thanh toán bằng tổng gồm VAT', async () => {
    const wb = await openWorkbook(base());
    const sheet = wb.getWorksheet('Đối soát')!;

    let payable: number | null = null;
    sheet.eachRow((row) => {
      const label = String(row.getCell(1).value ?? '');
      if (label.startsWith('Tổng số tiền Bên A phải thanh toán')) {
        payable = row.getCell(6).value as number;
      }
    });

    expect(payable).toBe(1_650_000);
  });

  it('should liệt kê từng đơn và cộng tổng khớp mục I', async () => {
    const wb = await openWorkbook(base());
    const sheet = wb.getWorksheet('Chi tiết giao dịch')!;

    // 1 dòng tiêu đề + 2 đơn + 1 dòng tổng
    expect(sheet.rowCount).toBe(4);
    // Bộ cột theo đúng sheet mẫu.
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      'STT',
      'Mã đơn hàng',
      'Tên sản phẩm',
      'Doanh thu đơn hàng',
      'Nguồn ghi nhận',
      'Khách hàng',
      'Số lượng eSIM',
      'Mức % hoa hồng',
      'Tiền hoa hồng',
      'Trạng thái đơn hàng',
      'Ngày đặt hàng',
    ]);
    expect(String(sheet.getCell('B2').value)).toBe(
      'ORD-260805120000001-ABC123',
    );
    expect(String(sheet.getCell('E2').value)).toBe('Link - EOKIC5TO');
    expect(String(sheet.getCell('F2').value)).toBe('Khách mới');
    expect(String(sheet.getCell('J3').value)).toBe('Chờ xác nhận');
    expect(String(sheet.getCell('K2').value)).toBe('05/08/2026');

    const totalRow = sheet.getRow(4);
    expect(String(totalRow.getCell(2).value)).toBe('TỔNG CỘNG');
    expect(totalRow.getCell(7).value).toBe(3); // số eSIM
    // Tổng hoa hồng phải bằng con số ở mục I của biên bản.
    expect(totalRow.getCell(9).value).toBe(1_500_000);
  });

  it('should ghi các dòng "Căn cứ…" lấy từ hồ sơ đối tác', async () => {
    const text = sheetText(await openWorkbook(base()), 'Đối soát');

    expect(text).toContain('012025/HĐĐL–MOBICAST–ESIM');
  });

  it('should chạy được khi đối tác chưa khai hợp đồng hay chức vụ', async () => {
    // Đối tác cá nhân thường không có 2 thứ này; thiếu thì bỏ dòng, không vỡ file.
    const data = base();
    data.contractLines = [];
    data.partyB.position = undefined;

    const wb = await openWorkbook(data);
    const text = sheetText(wb, 'Đối soát');

    expect(text).toContain('Chức vụ:');
    expect(wb.worksheets).toHaveLength(2);
  });

  it('should chạy được khi kỳ không có giao dịch nào', async () => {
    const data = base();
    data.transactions = [];
    data.commissionVnd = 0;

    const wb = await openWorkbook(data);
    const sheet = wb.getWorksheet('Chi tiết giao dịch')!;

    expect(sheet.rowCount).toBe(2); // tiêu đề + dòng tổng
    expect(sheetText(wb, 'Đối soát')).toContain('Bằng chữ: Không đồng');
  });
});
