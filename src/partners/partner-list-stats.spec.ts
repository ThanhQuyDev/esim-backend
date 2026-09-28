import { PartnersService } from './partners.service';

/**
 * The four figures at the head of "Danh sách đối tác" (#057).
 *
 * All four describe the state of the accounts, which is what that page lists —
 * a different question from the overview's "đang hoạt động", which counts who
 * actually traded (#051). The one rule that is easy to miss: a locked account
 * is left out of the total, because counting accounts nobody can use would
 * overstate the programme.
 */

function buildService(rows: Record<string, unknown>[]) {
  const query = jest.fn().mockResolvedValue(rows);
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

describe('PartnersService.adminPartnerListStats (#057)', () => {
  it('should split every figure by partner type', async () => {
    const { service } = buildService([
      {
        partnerType: 'kol',
        total: '40',
        active: '30',
        onHold: '2',
        newThisMonth: '5',
      },
      {
        partnerType: 'distribution',
        total: '10',
        active: '8',
        onHold: '1',
        newThisMonth: '2',
      },
    ]);

    const result = await service.adminPartnerListStats();

    expect(result.total).toEqual({
      count: 50,
      byType: [
        { partnerType: 'distribution', count: 10 },
        { partnerType: 'kol', count: 40 },
      ],
    });
    expect(result.newThisMonth.count).toBe(7);
    expect(result.onHold.count).toBe(3);
  });

  it('should leave locked accounts out of the total', async () => {
    const { service, query } = buildService([]);

    await service.adminPartnerListStats();

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('COUNT(*) FILTER (WHERE status <> $1)');
    // $1 is the locked state, passed as a parameter rather than written in.
    expect(params[0]).toBe('disabled');
    expect(params[1]).toBe('active');
    expect(params[2]).toBe('hold');
  });

  it('should read "mới trong tháng" from the start of this month', async () => {
    const { service, query } = buildService([]);

    await service.adminPartnerListStats();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain("date_trunc('month', now())");
    // And a locked account is not "new" either.
    expect(sql).toContain(
      'WHERE status <> $1\n                  AND "createdAt"',
    );
  });

  it('should give the active share as a percentage of the total', async () => {
    const { service } = buildService([
      {
        partnerType: 'kol',
        total: '40',
        active: '30',
        onHold: '0',
        newThisMonth: '0',
      },
    ]);

    const result = await service.adminPartnerListStats();

    expect(result.active.percentOfTotal).toBe(75);
  });

  it('should not divide by nothing when there are no partners', async () => {
    const { service } = buildService([]);

    const result = await service.adminPartnerListStats();

    expect(result.total.count).toBe(0);
    expect(result.active.percentOfTotal).toBe(0);
    expect(result.onHold.byType).toEqual([]);
  });
});
