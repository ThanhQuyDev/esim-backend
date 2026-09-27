import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * The dashboard window the partner picks (#010).
 *
 * Every figure used to be "last 30 days" with no way to ask for anything else.
 * The bounds matter more than they look: "Hôm nay" must include an order placed
 * at 16:00 today, so the upper bound is the start of tomorrow, not now.
 */

function buildService() {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const calls: unknown[][] = [];

  Object.assign(service, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 5,
      partnerType: PartnerTypeEnum.KOL,
      tierCode: null,
    }),
    dataSource: {
      query: jest.fn((_sql: string, params: unknown[]) => {
        calls.push(params);
        return Promise.resolve([{}]);
      }),
    },
    getWalletSummaryForPartner: jest.fn().mockResolvedValue({ balanceVnd: 0 }),
    tierRepository: { find: jest.fn().mockResolvedValue([]) },
  });

  return { service, calls };
}

describe('PartnersService — dashboard period filter (#010)', () => {
  it('should cover the whole of a single chosen day', async () => {
    const { service, calls } = buildService();

    const summary = await service.getMySummary(5, {
      from: '2026-09-20',
      to: '2026-09-20',
    });

    const [, from, to] = calls[0] as [number, Date, Date];
    expect(from.getDate()).toBe(20);
    expect(from.getHours()).toBe(0);
    // Start of the next day, so 16:00 on the 20th still counts.
    expect(to.getDate()).toBe(21);
    expect(to.getHours()).toBe(0);
    expect(summary.range.from).toBe(from.toISOString());
  });

  it('should apply the same window to orders, commissions and clicks', async () => {
    const { service, calls } = buildService();

    await service.getMySummary(5, { from: '2026-09-01', to: '2026-09-07' });

    const windows = calls
      .slice(0, 3)
      .map(([, from, to]) => [
        (from as Date).toISOString(),
        (to as Date).toISOString(),
      ]);
    expect(windows[1]).toEqual(windows[0]);
    expect(windows[2]).toEqual(windows[0]);
  });

  it('should ask the same window for the customer split (#011)', async () => {
    const { service, calls } = buildService();

    await service.getMySummary(5, { from: '2026-09-01', to: '2026-09-07' });

    // orders, commissions, clicks, customers, month-over-month
    const [, from, to] = calls[3] as [number, Date, Date];
    const [, firstFrom, firstTo] = calls[0] as [number, Date, Date];
    expect(from.toISOString()).toBe(firstFrom.toISOString());
    expect(to.toISOString()).toBe(firstTo.toISOString());
  });

  it('should fall back to the last 30 days when nothing is chosen', async () => {
    const { service, calls } = buildService();

    await service.getMySummary(5);

    const [, from, to] = calls[0] as [number, Date, Date];
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    expect(days).toBe(30);
  });

  it('should ignore a date it cannot read rather than querying NaN', async () => {
    const { service, calls } = buildService();

    await service.getMySummary(5, { from: 'hôm nay' });

    const [, from] = calls[0] as [number, Date];
    expect(Number.isNaN(from.getTime())).toBe(false);
  });
});
