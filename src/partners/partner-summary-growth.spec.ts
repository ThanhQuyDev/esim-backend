import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * "% tăng trưởng cùng kỳ so với tháng trước" on the partner dashboard (#008).
 *
 * The comparison is this month so far against the same days of last month —
 * whole months would flatter the 1st and punish the 2nd.
 */

function buildService(commissionThis: number, commissionPrev: number) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const rows = [
    [{ revenue30: 0, orders30: 0, revenueTotal: 0, ordersTotal: 0 }],
    [{ commission30: 0, commissionTotal: 0, commissionPending: 0 }],
    [{ clicks30: 0, clicksTotal: 0 }],
    [{ commissionThis, commissionPrev }],
  ];
  let call = 0;

  Object.assign(service, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 5,
      partnerType: PartnerTypeEnum.KOL,
      tierCode: null,
    }),
    dataSource: { query: jest.fn(() => Promise.resolve(rows[call++])) },
    getWalletSummaryForPartner: jest.fn().mockResolvedValue({
      balanceVnd: 0,
      availableBalanceVnd: 0,
      carriedDebtVnd: 0,
    }),
    tierRepository: { find: jest.fn().mockResolvedValue([]) },
  });

  return service;
}

describe('PartnersService — month-over-month growth (#008)', () => {
  it('should report the rise against the same days last month', async () => {
    const summary = await buildService(1_500_000, 1_000_000).getMySummary(5);

    expect(summary.monthOverMonth).toEqual({
      commissionVnd: 1_500_000,
      previousCommissionVnd: 1_000_000,
      commissionGrowthPercent: 50,
    });
  });

  it('should report a fall as a negative percent', async () => {
    const summary = await buildService(400_000, 1_000_000).getMySummary(5);

    expect(summary.monthOverMonth.commissionGrowthPercent).toBe(-60);
  });

  it('should not divide by a month that earned nothing', async () => {
    // First month with earnings reads as +100%, not infinity.
    const first = await buildService(900_000, 0).getMySummary(5);
    expect(first.monthOverMonth.commissionGrowthPercent).toBe(100);

    const quiet = await buildService(0, 0).getMySummary(5);
    expect(quiet.monthOverMonth.commissionGrowthPercent).toBe(0);
  });
});
