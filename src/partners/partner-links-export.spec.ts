import * as ExcelJS from 'exceljs';
import { PartnersService } from './partners.service';
import { PartnerLinkStatusEnum } from './partners.enum';

/**
 * The partner's links as a spreadsheet (#017).
 *
 * A campaign report happens in Excel, so the columns have to be the ones the
 * brief lists and the numbers have to be the ones the portal shows — including
 * commission already net of refunded orders (#016).
 */

function buildService(links: Record<string, unknown>[]) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    linkRepository: { find: jest.fn().mockResolvedValue(links) },
  });
  return service;
}

async function readSheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const rows: unknown[][] = [];
  sheet.eachRow((row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  return { sheet, rows };
}

describe('PartnersService — exporting the link list (#017)', () => {
  it('should write the columns the brief asks for', async () => {
    const service = buildService([]);

    const { rows } = await readSheet(await service.exportMyLinksToExcel(5));

    expect(rows[0]).toEqual([
      'Tên chiến dịch',
      'Trang đích',
      'Link tiếp thị',
      'Số lượt click',
      'Tổng đơn hàng',
      'Tổng hoa hồng (VND)',
      'Trạng thái',
    ]);
  });

  it('should write each link with its landing page and readable status', async () => {
    const service = buildService([
      {
        label: 'Video Nhật Bản',
        code: 'VANA2026',
        targetPath: '/esim-nhat-ban?utm_source=youtube',
        clickCount: 120,
        conversionCount: 8,
        totalCommissionVnd: 640000,
        status: PartnerLinkStatusEnum.ACTIVE,
      },
      {
        label: 'Chiến dịch cũ',
        code: 'OLDCODE1',
        targetPath: null,
        clickCount: 0,
        conversionCount: 0,
        totalCommissionVnd: 0,
        status: PartnerLinkStatusEnum.INACTIVE,
      },
    ]);

    const { rows } = await readSheet(await service.exportMyLinksToExcel(5));

    // The utm parameters the portal appends are noise in this column.
    expect(rows[1]).toEqual([
      'Video Nhật Bản',
      '/esim-nhat-ban',
      'esim.vn/r/VANA2026',
      120,
      8,
      640000,
      'Đang hoạt động',
    ]);
    expect(rows[2][1]).toBe('Trang chủ');
    expect(rows[2][6]).toBe('Đã tắt');
  });
});
