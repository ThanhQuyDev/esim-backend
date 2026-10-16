import { PartnersService } from './partners.service';

/**
 * doitac-1410 #052 / #054 — the admin's "Tiếp thị liên kết" list and its
 * filters.
 */
function build(rows: Record<string, unknown>[] = []) {
  const query = jest
    .fn()
    .mockResolvedValueOnce([{ total: rows.length }])
    .mockResolvedValueOnce(rows);
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

const sqlOf = (query: jest.Mock) => query.mock.calls[1] as [string, unknown[]];

describe('PartnersService.adminListLinks (doitac-1410 #052)', () => {
  it('should number every filter parameter in order', async () => {
    const { service, query } = build();
    await service.adminListLinks({
      partner: '#9',
      link: 'esim.vn/go/VANA2026',
      channel: 'tiktok',
      createdFrom: '2026-10-01',
      createdTo: '2026-10-16',
      updatedFrom: '2026-10-10',
      updatedTo: '2026-10-16',
      actor: 'admin',
    });
    const [sql, params] = sqlOf(query);
    // partner id, link text + code, channel, created ×2, updated ×2, actor
    expect(params).toHaveLength(9);
    expect(params.slice(0, 4)).toEqual([
      9,
      'esim.vn/go/VANA2026',
      'VANA2026',
      'tiktok',
    ]);
    expect(params[8]).toBe('admin');
    for (let i = 1; i <= 9; i += 1) expect(sql).toContain(`$${i}`);
    expect(sql).not.toContain('$10');
    // "#9" is partner 9, not every phone number with a 9 in it.
    expect(sql).toContain('p.id = $1');
    expect(sql).not.toContain('p."contactPhone" ILIKE');
    expect(sql).toContain('l.code ILIKE');
    expect(sql).toContain(`COALESCE(ev."lastActor", 'partner') = $9`);
  });

  it('should search name, email and phone when the partner text is not an id', async () => {
    const { service, query } = build();
    await service.adminListLinks({ partner: '0901234567' });
    const [sql, params] = sqlOf(query);
    expect(params).toEqual(['0901234567']);
    expect(sql).toContain('p."contactPhone" ILIKE');
  });

  it.each([
    ['appealing', `l.status = 'suspended' AND l."appealedAt" IS NOT NULL`],
    ['restore_pending', `l."restoreRequestedAt" IS NOT NULL`],
    ['inactive', `l.status = 'inactive'`],
  ])('should filter the "%s" state', async (state, clause) => {
    const { service, query } = build();
    await service.adminListLinks({ status: state });
    expect(sqlOf(query)[0]).toContain(clause);
  });

  it('should read each link with its state, partner and figures', async () => {
    const { service } = build([
      {
        id: 3,
        code: 'VANA2026',
        label: 'Review Nhật',
        targetPath: '/japan?utm_source=youtube',
        status: 'suspended',
        deletedAt: null,
        appealedAt: '2026-10-15T00:00:00Z',
        restoreRequestedAt: null,
        partnerId: 9,
        contactName: 'Nguyễn A',
        companyName: 'Công ty ABC',
        legalType: 'company',
        lastChangedAt: '2026-10-15T00:00:00Z',
        lastActor: 'admin',
        createdBy: 'partner',
        edits: '2',
        clickCount: '40',
        orders: 3,
        commissionVnd: '120000',
      },
    ]);
    const result = await service.adminListLinks({});
    expect(result.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      state: 'appealing',
      partner: { id: 9, name: 'Công ty ABC' },
      createdBy: 'partner',
      updatedBy: 'admin',
      editCount: 2,
      clicks: 40,
      orders: 3,
      commissionVnd: 120000,
    });
  });

  it('should run an open "từ" to today and an open "đến" from the start', async () => {
    const { service, query } = build();
    await service.adminListLinks({ updatedFrom: '2026-10-10' });
    const [, params] = sqlOf(query);
    const [from, to] = params as Date[];
    expect(from.toISOString()).toBe('2026-10-09T17:00:00.000Z');
    // Up to the end of today in Vietnam, not the end of 10/10.
    expect(to.getTime()).toBeGreaterThan(Date.now());
  });
});
