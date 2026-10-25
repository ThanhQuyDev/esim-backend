import { announcementWindow } from './announcement-window';
import {
  audienceSql,
  CustomerAnnouncementsService,
} from './customer-announcements.service';

/** "Thông báo khách hàng" (vande #072). */

// Thursday 12 November 2026, 09:30 in Vietnam (02:30 UTC).
const NOW = new Date('2026-11-12T02:30:00Z');

describe('announcementWindow (vande #072)', () => {
  it('should count rolling days back from now', () => {
    const { from, to } = announcementWindow('last_7_days', NOW);
    expect(from?.toISOString()).toBe('2026-11-05T02:30:00.000Z');
    expect(to).toBeNull();
  });

  it('should read "tuần trước" as last Monday to Sunday in Vietnam', () => {
    const { from, to } = announcementWindow('last_week', NOW);
    // Monday 2/11 00:00 VN to Monday 9/11 00:00 VN.
    expect(from?.toISOString()).toBe('2026-11-01T17:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-11-08T17:00:00.000Z');
  });

  it('should read "tháng trước" as the whole of last month in Vietnam', () => {
    const { from, to } = announcementWindow('last_month', NOW);
    expect(from?.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('should start the new week at Monday 00:00 in Vietnam, not UTC', () => {
    // Monday 16/11 00:30 in Vietnam is still Sunday 17:30 UTC; in Vietnam the
    // week of 9–15/11 is already "tuần trước".
    const { from, to } = announcementWindow(
      'last_week',
      new Date('2026-11-15T17:30:00Z'),
    );
    expect(from?.toISOString()).toBe('2026-11-08T17:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-11-15T17:00:00.000Z');
  });

  it('should go back whole months for 6 and 12 months', () => {
    expect(announcementWindow('last_6_months', NOW).from?.toISOString()).toBe(
      '2026-05-12T02:30:00.000Z',
    );
    expect(announcementWindow('last_12_months', NOW).from?.toISOString()).toBe(
      '2025-11-12T02:30:00.000Z',
    );
  });

  it('should have no bounds "từ trước tới nay"', () => {
    expect(announcementWindow('all_time', NOW)).toEqual({
      from: null,
      to: null,
    });
  });
});

describe('audienceSql (vande #072)', () => {
  it('should send only to storefront customers, by main or extra role', () => {
    const sql = audienceSql('purchased');
    expect(sql).toContain('u."roleId" = 2 OR 2 = ANY(u."extraRoleIds")');
    expect(sql).toContain('u."deletedAt" IS NULL');
  });

  it('should count a customer with a failed and a good order as purchased', () => {
    const failed = audienceSql('failed');
    expect(failed).toContain(`o.status = 'failed'`);
    expect(failed).toMatch(
      /NOT EXISTS \(SELECT 1 FROM "order" o WHERE o."userId" = u.id AND o.status IN \('paid', 'completed', 'refunded'\)\)/,
    );
  });

  it('should take a new customer as one who never ordered', () => {
    const sql = audienceSql('new');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('u."createdAt" >=');
  });
});

describe('CustomerAnnouncementsService.cancel (vande #072)', () => {
  function build(updated: unknown[], existing: unknown[]) {
    const query = jest
      .fn()
      .mockResolvedValueOnce([updated, updated.length])
      .mockResolvedValueOnce(existing);
    const service = new CustomerAnnouncementsService(
      { query } as never,
      {} as never,
    );
    return { service, query };
  }

  it('should cancel one that has not finished', async () => {
    const { service } = build([{ id: 4, status: 'cancelled' }], []);
    await expect(service.cancel(4)).resolves.toMatchObject({
      status: 'cancelled',
    });
  });

  it('should refuse one already sent', async () => {
    const { service } = build([], [{ status: 'sent' }]);
    await expect(service.cancel(4)).rejects.toThrow('đã gửi xong');
  });
});
