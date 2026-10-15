import { PartnersService } from './partners.service';
import { PartnerLinkStatusEnum } from './partners.enum';

/**
 * The marketing link page's new behaviour (doitac-1410 #018): restoring a
 * deleted link, appealing a suspension, an admin suspending one link, and the
 * list's filters and order.
 */

const DAY = 24 * 60 * 60 * 1000;

function buildService(
  link: Record<string, unknown> | null,
  partner: Record<string, unknown> = {},
) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const savedEvents: Record<string, unknown>[] = [];
  const queries: { sql: string; params: unknown[] }[] = [];
  const update = jest.fn().mockResolvedValue(undefined);
  const restore = jest.fn().mockResolvedValue(undefined);
  const notifications: Record<string, unknown>[] = [];
  const sendPartnerNotification = jest.fn().mockResolvedValue(undefined);
  Object.assign(service, {
    logger: { error: jest.fn(), warn: jest.fn() },
    linkRepository: {
      findOne: jest.fn().mockResolvedValue(link),
      update,
      restore,
    },
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 9,
      status: 'active',
      contactEmail: 'kol@example.com',
      contactName: 'KOL',
      ...partner,
    }),
    notificationRepository: {
      create: (row: Record<string, unknown>) => row,
      save: jest.fn().mockImplementation((row) => {
        notifications.push(row);
        return Promise.resolve(row);
      }),
    },
    mailService: { sendPartnerNotification },
    dataSource: {
      getRepository: () => ({
        create: (row: Record<string, unknown>) => row,
        save: jest.fn().mockImplementation((row) => {
          savedEvents.push(row);
          return Promise.resolve(row);
        }),
        find: jest.fn().mockResolvedValue([]),
      }),
      query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return Promise.resolve(link ? [{ ...link, id: 5 }] : []);
      }),
    },
  });
  return {
    service,
    savedEvents,
    queries,
    update,
    restore,
    notifications,
    sendPartnerNotification,
  };
}

describe('marketing links (doitac-1410 #018)', () => {
  describe('restoring a deleted link', () => {
    it('should bring it back within 30 days and say so in its history', async () => {
      const { service, restore, savedEvents } = buildService({
        id: 5,
        partnerId: 9,
        deletedAt: new Date(Date.now() - 10 * DAY),
      });

      await service.restoreMyLink(9, 5);

      expect(restore).toHaveBeenCalledWith({ id: 5 });
      expect(savedEvents.map((e) => e.action)).toContain('restored');
    });

    it('should leave it to esim.vn after 30 days', async () => {
      const { service, restore } = buildService({
        id: 5,
        partnerId: 9,
        deletedAt: new Date(Date.now() - 31 * DAY),
      });

      await expect(service.restoreMyLink(9, 5)).rejects.toThrow(
        'gửi yêu cầu khôi phục',
      );
      expect(restore).not.toHaveBeenCalled();
    });
  });

  describe('appealing', () => {
    it('should record the appeal of a link esim.vn suspended', async () => {
      const { service, update, savedEvents } = buildService({
        id: 5,
        partnerId: 9,
        suspendedByAdmin: true,
        appealedAt: null,
      });

      await service.appealMyLink(9, 5, 321);

      expect(update).toHaveBeenCalledWith(
        { id: 5 },
        { appealedAt: expect.any(Date), appealTicketId: 321 },
      );
      expect(savedEvents[0]).toMatchObject({
        action: 'appealed',
        actorRole: 'partner',
      });
    });

    it('should refuse a link that was not suspended by esim.vn', async () => {
      const { service } = buildService({
        id: 5,
        partnerId: 9,
        suspendedByAdmin: false,
      });
      await expect(service.appealMyLink(9, 5)).rejects.toThrow(
        'không bị esim.vn đình chỉ',
      );
    });

    it('should refuse a second appeal while one is open', async () => {
      const { service } = buildService({
        id: 5,
        partnerId: 9,
        suspendedByAdmin: true,
        appealedAt: new Date(),
      });
      await expect(service.appealMyLink(9, 5)).rejects.toThrow(
        'đang được kháng nghị',
      );
    });
  });

  describe('an admin suspending one link', () => {
    it('should suspend it, keep what it was, and tell the partner why', async () => {
      const {
        service,
        update,
        savedEvents,
        notifications,
        sendPartnerNotification,
      } = buildService({
        id: 5,
        partnerId: 9,
        code: 'MINHTRAN',
        label: 'Video Nhật Bản',
        status: PartnerLinkStatusEnum.INACTIVE,
        suspendedByAdmin: false,
      });

      await service.adminSetLinkSuspension(
        5,
        { suspended: true, reason: 'Nội dung vi phạm chính sách' },
        1,
      );

      expect(update).toHaveBeenCalledWith(
        { id: 5 },
        expect.objectContaining({
          status: PartnerLinkStatusEnum.SUSPENDED,
          statusBeforeSuspend: PartnerLinkStatusEnum.INACTIVE,
          suspendedByAdmin: true,
          suspendedReason: 'Nội dung vi phạm chính sách',
        }),
      );
      expect(savedEvents[0]).toMatchObject({
        action: 'suspended',
        actorRole: 'admin',
      });
      // In the portal, to this partner only, and by email.
      expect(notifications[0]).toMatchObject({ partnerId: 9 });
      expect(String(notifications[0].body)).toContain(
        'Nội dung vi phạm chính sách',
      );
      expect(sendPartnerNotification).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'kol@example.com' }),
      );
    });

    it('should give the link back what it was when released', async () => {
      const { service, update } = buildService({
        id: 5,
        partnerId: 9,
        code: 'MINHTRAN',
        label: 'Video Nhật Bản',
        status: PartnerLinkStatusEnum.SUSPENDED,
        statusBeforeSuspend: PartnerLinkStatusEnum.INACTIVE,
        suspendedByAdmin: true,
      });

      await service.adminSetLinkSuspension(
        5,
        { suspended: false, reason: 'Đã xác minh' },
        1,
      );

      expect(update).toHaveBeenCalledWith(
        { id: 5 },
        expect.objectContaining({
          status: PartnerLinkStatusEnum.INACTIVE,
          suspendedByAdmin: false,
        }),
      );
    });

    it('should leave it suspended with the account while the account is locked', async () => {
      const { service, update } = buildService(
        {
          id: 5,
          partnerId: 9,
          code: 'MINHTRAN',
          label: 'Video',
          status: PartnerLinkStatusEnum.SUSPENDED,
          suspendedByAdmin: true,
        },
        { status: 'hold' },
      );

      await service.adminSetLinkSuspension(
        5,
        { suspended: false, reason: 'Đã xác minh' },
        1,
      );

      expect(update.mock.calls[0][1]).not.toHaveProperty('status');
    });
  });

  describe('the list', () => {
    it('should filter by status and channel and sort by the last click', async () => {
      const { service, queries } = buildService({ id: 5, partnerId: 9 });

      await service.getMyLinks(9, {
        status: 'active',
        channel: 'tiktok',
        sort: 'lastClick',
      });

      const { sql, params } = queries[0];
      expect(params).toEqual(expect.arrayContaining(['active', 'tiktok']));
      expect(sql).toMatch(/utm_source/);
      expect(sql).toMatch(/"lastClickedAt" DESC NULLS LAST/);
    });

    it('should hand commission back as a number, not text', async () => {
      const { service } = buildService({
        id: 5,
        partnerId: 9,
        totalCommissionVnd: '260868',
        periodCommissionVnd: '1000',
      });

      const [row] = await service.getMyLinks(9);

      // Summed as text in the browser, it read a million times too large.
      expect(row.totalCommissionVnd).toBe(260868);
      expect(row.periodCommissionVnd).toBe(1000);
    });
  });

  describe('deleted links (doitac-1410 #019)', () => {
    it('should send a link restored once already to admin approval', async () => {
      const { service, restore } = buildService({
        id: 5,
        partnerId: 9,
        deletedAt: new Date(Date.now() - DAY),
        restoreCount: 1,
      });

      await expect(service.restoreMyLink(9, 5)).rejects.toThrow(
        'đã khôi phục 1 lần',
      );
      expect(restore).not.toHaveBeenCalled();
    });

    it('should file the request and keep the link deleted', async () => {
      const { service, update, restore, savedEvents } = buildService({
        id: 5,
        partnerId: 9,
        deletedAt: new Date(Date.now() - 40 * DAY),
        restoreRequestedAt: null,
      });

      await service.requestMyLinkRestore(9, 5, '  Link đang in trên tờ rơi  ');

      expect(update).toHaveBeenCalledWith(
        { id: 5 },
        {
          restoreRequestedAt: expect.any(Date),
          restoreRequestReason: 'Link đang in trên tờ rơi',
        },
      );
      expect(restore).not.toHaveBeenCalled();
      expect(savedEvents[0]).toMatchObject({ action: 'restore_requested' });
    });

    it('should not file a second request while one waits', async () => {
      const { service } = buildService({
        id: 5,
        partnerId: 9,
        deletedAt: new Date(),
        restoreRequestedAt: new Date(),
      });
      await expect(service.requestMyLinkRestore(9, 5, 'x')).rejects.toThrow(
        'đang chờ admin phê duyệt',
      );
    });

    it('should restore on approval and tell the partner', async () => {
      const { service, restore, savedEvents, notifications } = buildService({
        id: 5,
        partnerId: 9,
        code: 'MINHTRAN',
        label: 'Video Nhật Bản',
        deletedAt: new Date(),
        restoreRequestedAt: new Date(),
      });

      await service.adminDecideLinkRestore(5, { approve: true }, 1);

      expect(restore).toHaveBeenCalledWith({ id: 5 });
      expect(savedEvents[0]).toMatchObject({
        action: 'restored',
        actorRole: 'admin',
      });
      expect(String(notifications[0].title)).toContain('đã được khôi phục');
    });

    it('should leave it deleted on refusal, with the reason told', async () => {
      const { service, restore, notifications } = buildService({
        id: 5,
        partnerId: 9,
        code: 'MINHTRAN',
        label: 'Video Nhật Bản',
        deletedAt: new Date(),
        restoreRequestedAt: new Date(),
      });

      await service.adminDecideLinkRestore(
        5,
        { approve: false, note: 'Link vi phạm' },
        1,
      );

      expect(restore).not.toHaveBeenCalled();
      expect(String(notifications[0].body)).toContain('Link vi phạm');
    });
  });

  describe('channel performance (doitac-1410 #019)', () => {
    it('should work out conversion as orders over clicks, with a total', async () => {
      const service = Object.create(
        PartnersService.prototype,
      ) as PartnersService;
      Object.assign(service, {
        dataSource: {
          query: jest.fn().mockResolvedValue([
            {
              channel: 'youtube',
              links: 3,
              clicks: 200,
              orders: 10,
              revenueVnd: '3000000',
              commissionVnd: '210000',
            },
            {
              channel: 'other',
              links: 1,
              clicks: 50,
              orders: 1,
              revenueVnd: '500000',
              commissionVnd: '35000',
            },
          ]),
        },
      });

      const result = await service.getMyChannelPerformance(9);

      expect(result.channels[0]).toMatchObject({
        channel: 'youtube',
        revenueVnd: 3000000,
        conversionPercent: 5,
      });
      expect(result.total).toMatchObject({
        links: 4,
        clicks: 250,
        orders: 11,
        commissionVnd: 245000,
        conversionPercent: 4.4,
      });
    });
  });
});
