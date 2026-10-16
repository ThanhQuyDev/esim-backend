import { PartnersService } from './partners.service';

/**
 * doitac-1410 #051 — the four figures on top of the admin's "Tiếp thị liên
 * kết" page: links in total (live, orders, commission), landing pages changed
 * in the window, suspended (appealing) and waiting to be restored (deleted,
 * paused).
 */
function build(rows: {
  links?: Record<string, unknown>;
  period?: Record<string, unknown>;
}) {
  const query = jest
    .fn()
    .mockResolvedValueOnce([rows.links ?? {}])
    .mockResolvedValueOnce([rows.period ?? {}]);
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

describe('PartnersService.adminLinkStats (doitac-1410 #051)', () => {
  it('should put every tile and its small line together', async () => {
    const { service } = build({
      links: {
        total: 12,
        active: 9,
        paused: 1,
        suspended: 2,
        appealing: 1,
        deleted: 3,
        restorePending: 1,
      },
      period: { orders: 7, commissionVnd: '845000', retargeted: 4 },
    });

    const stats = await service.adminLinkStats({
      from: '2026-10-10',
      to: '2026-10-16',
    });

    expect(stats).toMatchObject({
      days: 7,
      total: { links: 12, active: 9, orders: 7, commissionVnd: 845000 },
      retargeted: 4,
      suspended: { links: 2, appealing: 1 },
      restorePending: { links: 1, deleted: 3, paused: 1 },
    });
  });

  it('should count landing-page changes and orders in the window only', async () => {
    const { service, query } = build({});
    await service.adminLinkStats({ from: '2026-10-16', to: '2026-10-16' });

    const [sql, params] = query.mock.calls[1] as [string, Date[]];
    expect(sql).toContain("e.action = 'retargeted'");
    expect(sql).toContain('e."createdAt" >= $1 AND e."createdAt" < $2');
    // One Vietnamese day: 16/10 00:00 → 17/10 00:00 (UTC+7).
    expect(params[0].toISOString()).toBe('2026-10-15T17:00:00.000Z');
    expect(params[1].toISOString()).toBe('2026-10-16T17:00:00.000Z');
  });

  it('should read an empty programme as zeroes', async () => {
    const { service } = build({});
    const stats = await service.adminLinkStats();
    expect(stats.total).toEqual({
      links: 0,
      active: 0,
      orders: 0,
      commissionVnd: 0,
    });
    expect(stats.restorePending).toEqual({ links: 0, deleted: 0, paused: 0 });
  });
});
