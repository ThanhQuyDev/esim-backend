import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { PartnersService } from './partners.service';

/**
 * doitac-1410 #053 — bulk "Thay đổi trạng thái", the admin bringing a deleted
 * link back, the list as a file, and a link created for a partner showing as
 * created by the admin.
 */
function service(extra: Record<string, unknown> = {}) {
  const s = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(s, extra);
  return s;
}

describe('PartnersService.adminBulkLinkStatus (doitac-1410 #053)', () => {
  it('should apply the action link by link and report the ones it does not fit', async () => {
    const adminSetLinkSuspension = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new BadRequestException('Link này đang bị đình chỉ.'),
      )
      .mockResolvedValueOnce({});
    const s = service({ adminSetLinkSuspension });

    const result = await s.adminBulkLinkStatus(
      {
        linkIds: [3, 4, 5, 3],
        action: 'suspend',
        reason: 'Vi phạm chính sách',
      },
      1,
    );

    expect(adminSetLinkSuspension).toHaveBeenCalledTimes(3);
    expect(adminSetLinkSuspension).toHaveBeenCalledWith(
      3,
      { suspended: true, reason: 'Vi phạm chính sách' },
      1,
    );
    expect(result).toEqual({
      done: [3, 5],
      skipped: [{ id: 4, reason: 'Link này đang bị đình chỉ.' }],
    });
  });

  it('should restore deleted links one by one', async () => {
    const adminRestoreLink = jest.fn().mockResolvedValue({});
    const s = service({ adminRestoreLink });
    await s.adminBulkLinkStatus(
      { linkIds: [7], action: 'restore', reason: 'Xoá nhầm, đã xác minh' },
      2,
    );
    expect(adminRestoreLink).toHaveBeenCalledWith(
      7,
      'Xoá nhầm, đã xác minh',
      2,
    );
  });
});

describe('PartnersService.adminRestoreLink (doitac-1410 #053)', () => {
  it('should refuse a link that is not deleted', async () => {
    const s = service({
      linkRepository: {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 7, partnerId: 9, deletedAt: null }),
      },
    });
    await expect(s.adminRestoreLink(7, 'Xoá nhầm', 1)).rejects.toThrow(
      'Link này chưa bị xóa.',
    );
  });

  it('should restore, clear any request, log the reason and tell the partner', async () => {
    const update = jest.fn().mockResolvedValue({});
    const restore = jest.fn().mockResolvedValue({});
    const logLinkEvent = jest.fn().mockResolvedValue(undefined);
    const notifyOnePartner = jest.fn().mockResolvedValue(undefined);
    const s = service({
      linkRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          partnerId: 9,
          code: 'ABC12345',
          label: 'Trang chủ',
          deletedAt: new Date(),
          restoreRequestedAt: null,
        }),
        update,
        restore,
      },
      logLinkEvent,
      notifyOnePartner,
      getMyLinksByIds: jest.fn().mockResolvedValue([{ id: 7 }]),
    });

    await s.adminRestoreLink(7, '  Xoá nhầm, đã xác minh  ', 1);

    expect(update).toHaveBeenCalledWith(
      { id: 7 },
      { restoreRequestedAt: null, restoreRequestReason: null },
    );
    expect(restore).toHaveBeenCalledWith({ id: 7 });
    expect(logLinkEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      'restored',
      'admin',
      1,
      { reason: 'Xoá nhầm, đã xác minh' },
    );
    expect(notifyOnePartner.mock.calls[0][2]).toContain(
      'Xoá nhầm, đã xác minh',
    );
  });
});

describe('PartnersService.adminCreateLinkForPartner (doitac-1410 #053)', () => {
  it('should record the link as created by the admin', async () => {
    const logLinkEvent = jest.fn().mockResolvedValue(undefined);
    const s = service({
      getPartnerOrThrowById: jest.fn().mockResolvedValue({ id: 9 }),
      linkRepository: {
        findOne: jest.fn().mockResolvedValue(null),
        create: (v: unknown) => v,
        save: jest.fn((v: Record<string, unknown>) =>
          Promise.resolve({ id: 12, ...v }),
        ),
      },
      logLinkEvent,
    });
    await s.adminCreateLinkForPartner(
      9,
      {
        label: 'TikTok tháng 10',
        code: 'tiktok2026',
        targetPath: '/?utm_source=tiktok',
      },
      1,
    );
    expect(logLinkEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12, code: 'TIKTOK2026' }),
      'created',
      'admin',
      1,
      { label: 'TikTok tháng 10', targetPath: '/?utm_source=tiktok' },
    );
  });
});

describe('PartnersService.adminExportLinksToExcel (doitac-1410 #053)', () => {
  it('should export the filtered list with channel and source split out', async () => {
    const adminListLinks = jest.fn().mockResolvedValue({
      total: 1,
      data: [
        {
          id: 3,
          code: 'VANA2026',
          label: 'Review Nhật',
          targetPath: '/japan?utm_source=youtube&subid=video01',
          state: 'suspended',
          partner: { id: 9, name: 'Công ty ABC' },
          suspendedReason: 'Vi phạm',
          createdAt: '2026-10-10T03:00:00Z',
          createdBy: 'admin',
          updatedAt: '2026-10-15T03:00:00Z',
          updatedBy: 'admin',
          editCount: 1,
          clicks: 40,
          orders: 3,
          commissionVnd: 120000,
        },
      ],
    });
    const s = service({ adminListLinks });
    const buffer = await s.adminExportLinksToExcel({ status: 'suspended' });
    expect(adminListLinks).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suspended', limit: 100 }),
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    const sheet = wb.getWorksheet('Danh sách liên kết')!;
    const header = (sheet.getRow(1).values as unknown[]).slice(1);
    const row = (sheet.getRow(2).values as unknown[]).slice(1);
    const cell = (name: string) => row[header.indexOf(name)];
    expect(cell('Link tiếp thị')).toBe('esim.vn/go/VANA2026');
    expect(cell('Trang đích')).toBe('/japan');
    expect(cell('Kênh quảng bá')).toBe('youtube');
    expect(cell('Mã phân biệt nguồn')).toBe('video01');
    expect(cell('Trạng thái')).toBe('Bị đình chỉ');
    expect(cell('Tạo bởi')).toBe('Admin');
    expect(cell('Hoa hồng (VND)')).toBe(120000);
  });
});

describe('PartnersService.adminGetLinkDetail (doitac-1410 #054)', () => {
  it('should give the partner view of the link plus whose it is, deleted or not', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ id: 5, partnerId: 9, deletedAt: new Date() });
    const getMyLinkDetail = jest
      .fn()
      .mockResolvedValue({ id: 5, events: [], statusSince: 'x' });
    const s = service({
      linkRepository: { findOne },
      getPartnerOrThrowById: jest.fn().mockResolvedValue({
        id: 9,
        legalType: 'company',
        companyName: 'Công ty ABC',
        contactName: 'Nguyễn A',
        contactEmail: 'a@abc.vn',
      }),
      getMyLinkDetail,
      dataSource: { query: jest.fn().mockResolvedValue([]) },
    });
    const detail = await s.adminGetLinkDetail(5, { from: '2026-10-01' });
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 5 },
      withDeleted: true,
    });
    expect(getMyLinkDetail).toHaveBeenCalledWith(9, 5, { from: '2026-10-01' });
    expect(detail).toMatchObject({
      id: 5,
      partner: { id: 9, name: 'Công ty ABC', email: 'a@abc.vn' },
    });
  });
});

describe('Link internal notes (doitac-1410 #055)', () => {
  it('should store a note for admins only, trimmed', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 5 }])
      .mockResolvedValueOnce([{ id: 1, linkId: 5, body: 'Đã gọi xác minh' }]);
    const s = service({ dataSource: { query } });
    await s.adminAddLinkNote(5, '  Đã gọi xác minh  ', 1);
    const [sql, params] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO partner_link_note');
    expect(params).toEqual([5, 1, 'Đã gọi xác minh']);
  });

  it('should refuse an empty note', async () => {
    const s = service({ dataSource: { query: jest.fn() } });
    await expect(s.adminAddLinkNote(5, '   ', 1)).rejects.toThrow(
      'Vui lòng nhập nội dung ghi chú.',
    );
  });

  it('should keep the internal note of a status change with each link done', async () => {
    const adminSetLinkSuspension = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Link này đang bị đình chỉ.'));
    const adminAddLinkNote = jest.fn().mockResolvedValue({});
    const s = service({ adminSetLinkSuspension, adminAddLinkNote });
    await s.adminBulkLinkStatus(
      {
        linkIds: [3, 4],
        action: 'suspend',
        reason: 'Vi phạm chính sách',
        internalNote: 'Nguồn traffic ảo',
      },
      1,
    );
    // Only the link that was actually suspended carries the note.
    expect(adminAddLinkNote).toHaveBeenCalledTimes(1);
    expect(adminAddLinkNote).toHaveBeenCalledWith(3, 'Nguồn traffic ảo', 1);
  });

  it('should return the internal notes with the admin detail', async () => {
    const s = service({
      linkRepository: {
        findOne: jest.fn().mockResolvedValue({ id: 5, partnerId: 9 }),
      },
      getPartnerOrThrowById: jest
        .fn()
        .mockResolvedValue({ id: 9, contactName: 'A', contactEmail: 'a@x' }),
      getMyLinkDetail: jest.fn().mockResolvedValue({ id: 5, events: [] }),
      dataSource: {
        query: jest.fn().mockResolvedValue([
          {
            id: 2,
            body: 'Theo dõi thêm 1 tuần',
            createdAt: '2026-10-16T04:00:00Z',
            adminName: null,
            adminEmail: 'local-admin@esim.test',
          },
        ]),
      },
    });
    const detail = await s.adminGetLinkDetail(5);
    expect(detail.internalNotes).toEqual([
      {
        id: 2,
        body: 'Theo dõi thêm 1 tuần',
        createdAt: '2026-10-16T04:00:00Z',
        by: 'local-admin@esim.test',
      },
    ]);
  });
});
