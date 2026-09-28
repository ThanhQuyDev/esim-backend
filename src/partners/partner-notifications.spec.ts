import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * Announcements an admin sends to partners (#079).
 *
 * The bell is the delivery that always happens — a row everybody in the
 * audience can read, which cannot fail per-partner. The email is the extra,
 * and a partner with no address on file simply does not get one.
 */

function buildService({
  recipients = [],
  partner = { id: 8, partnerType: PartnerTypeEnum.KOL },
  rows = [],
}: {
  recipients?: Record<string, unknown>[];
  partner?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
} = {}) {
  const saved: Record<string, unknown>[] = [];
  const query = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('FROM partner p')) return Promise.resolve(recipients);
    return Promise.resolve(rows);
  });
  const sendPartnerNotification = jest.fn().mockResolvedValue(undefined);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { log: jest.fn(), error: jest.fn() },
    dataSource: { query },
    mailService: { sendPartnerNotification },
    getPartnerOrThrowById: jest.fn().mockResolvedValue(partner),
    notificationRepository: {
      create: (row: unknown) => ({ ...(row as object) }),
      save: jest.fn().mockImplementation((row) => {
        saved.push(row);
        return Promise.resolve({ id: 1, ...row });
      }),
    },
  });
  return { service, query, sendPartnerNotification, saved };
}

describe('PartnersService.adminCreateNotification (#079)', () => {
  it('should save the announcement once, however many partners it reaches', async () => {
    // One thing that was said, not four hundred copies of it.
    const { service, saved } = buildService();

    await service.adminCreateNotification(
      { title: '  Bảo trì hệ thống  ', body: '  01:00 - 03:00 ngày 05/10  ' },
      3,
    );

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      title: 'Bảo trì hệ thống',
      body: '01:00 - 03:00 ngày 05/10',
      audience: 'all',
      createdByAdminId: 3,
    });
  });

  it('should send no email at all when the admin did not ask for one', async () => {
    const { service, sendPartnerNotification } = buildService();

    await service.adminCreateNotification({ title: 'T', body: 'B' }, 3);

    expect(sendPartnerNotification).not.toHaveBeenCalled();
  });

  it('should email every partner in the audience when asked', async () => {
    const { service, sendPartnerNotification } = buildService({
      recipients: [
        { id: 8, contactName: 'A', contactEmail: 'a@example.com' },
        { id: 9, contactName: 'B', contactEmail: 'b@example.com' },
      ],
    });

    await service.adminCreateNotification(
      { title: 'T', body: 'B', sendEmail: true },
      3,
    );

    expect(sendPartnerNotification).toHaveBeenCalledTimes(2);
  });

  it('should record how many emails actually went out', async () => {
    // Not the size of the audience: a partner with no address gets the bell
    // and no email, and the sent list should not claim otherwise.
    const { service, sendPartnerNotification, saved } = buildService({
      recipients: [
        { id: 8, contactName: 'A', contactEmail: 'a@example.com' },
        { id: 9, contactName: 'B', contactEmail: 'b@example.com' },
      ],
    });
    sendPartnerNotification.mockRejectedValueOnce(new Error('smtp down'));

    await service.adminCreateNotification(
      { title: 'T', body: 'B', sendEmail: true },
      3,
    );

    expect(saved[saved.length - 1]).toMatchObject({ emailsSent: 1 });
  });

  it('should address a group rather than everybody when one is chosen', async () => {
    const { service, query } = buildService();

    await service.adminCreateNotification(
      { title: 'T', body: 'B', audience: 'distribution', sendEmail: true },
      3,
    );

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('distribution');
  });

  it('should leave locked accounts out of the audience', async () => {
    // An announcement is news somebody should act on; a locked account cannot.
    const { service, query } = buildService();

    await service.adminCreateNotification(
      { title: 'T', body: 'B', sendEmail: true },
      3,
    );

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('p.status = $1');
    expect(params[0]).toBe('active');
  });
});

describe('PartnersService.getMyNotifications (#079)', () => {
  it('should count what this partner has not opened', async () => {
    const { service } = buildService({
      rows: [
        {
          id: '1',
          title: 'A',
          body: 'a',
          createdAt: new Date(),
          isRead: false,
        },
        { id: '2', title: 'B', body: 'b', createdAt: new Date(), isRead: true },
      ],
    });

    const result = await service.getMyNotifications(8);

    expect(result.unreadCount).toBe(1);
    expect(result.data).toHaveLength(2);
  });

  it('should show the partner their own group and the general ones', async () => {
    const { service, query } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.DISTRIBUTION },
    });

    await service.getMyNotifications(8);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("n.audience = 'all' OR n.audience = $2");
    expect(params[1]).toBe('distribution');
  });

  it('should read the opened flag per partner, not per announcement', async () => {
    // The same announcement is read by one partner and not another.
    const { service, query } = buildService();

    await service.getMyNotifications(8);

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('r."partnerId" = $1');
  });
});

describe('PartnersService.markNotificationRead (#079)', () => {
  it('should not fail when the same announcement is opened twice', async () => {
    // The bell fires this on every render; it must not be able to error.
    const { service, query } = buildService();

    await expect(service.markNotificationRead(8, 1)).resolves.toEqual({
      ok: true,
    });

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('ON CONFLICT');
  });

  it('should mark only what this partner can see when clearing them all', async () => {
    const { service, query } = buildService({
      partner: { id: 8, partnerType: PartnerTypeEnum.KOL },
    });

    await service.markAllNotificationsRead(8);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("n.audience = 'all' OR n.audience = $2");
    expect(params[1]).toBe('kol');
  });
});
