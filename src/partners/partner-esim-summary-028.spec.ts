import { PartnersService } from './partners.service';

/**
 * doitac-3010 #028 — the line on top of "Quản lý eSIM": this month against
 * last month, by Vietnamese calendar month.
 */
function service(row: Record<string, unknown>) {
  const query = jest.fn().mockResolvedValue([row]);
  const s = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(s, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({ id: 2, userId: 280 }),
    dataSource: { query },
  });
  return { s, query };
}

describe('Quản lý eSIM — this month against last (doitac-3010 #028)', () => {
  it('should count, split and price each month', async () => {
    const { s } = service({
      thisCount: '12',
      thisActivated: '8',
      thisCost: '2400000',
      lastCount: '5',
      lastActivated: '5',
      lastCost: '900000',
    });
    await expect(s.getMyEsimSummary(2)).resolves.toEqual({
      thisMonth: { count: 12, activated: 8, idle: 4, costVnd: 2400000 },
      lastMonth: { count: 5, activated: 5, idle: 0, costVnd: 900000 },
    });
  });

  it('should cut the months at midnight in Vietnam, not in UTC', async () => {
    const { s, query } = service({});
    // 1 Nov 2026, 03:00 in Vietnam — still 31 Oct in UTC.
    await s.getMyEsimSummary(2, new Date('2026-10-31T20:00:00Z'));
    const [, params] = query.mock.calls[0];
    expect(params).toEqual([
      280,
      new Date('2026-10-31T17:00:00Z'),
      new Date('2026-11-30T17:00:00Z'),
      new Date('2026-09-30T17:00:00Z'),
    ]);
  });

  it('should answer zeros for a partner with no eSIM yet', async () => {
    const { s } = service({});
    const summary = await s.getMyEsimSummary(2);
    expect(summary.thisMonth).toEqual({
      count: 0,
      activated: 0,
      idle: 0,
      costVnd: 0,
    });
  });
});
