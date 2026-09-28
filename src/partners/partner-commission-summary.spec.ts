import { PartnersService } from './partners.service';

/**
 * The head of "Hoa hồng & Đối soát" (#063).
 *
 * Five stages of the same money, each with the partners behind it — a total on
 * its own does not say whether it is one payout to arrange or two hundred.
 * They must not be read as adding up: money that is "đã duyệt · chờ chi" is
 * also on its way to "đang yêu cầu thanh toán", and summing the tiles would
 * count it twice.
 */

function buildService(
  commissions: Record<string, unknown> = {},
  payouts: Record<string, unknown> = {},
) {
  const query = jest
    .fn()
    .mockResolvedValueOnce([
      {
        pendingVnd: '0',
        pendingPartners: '0',
        creditedVnd: '0',
        creditedPartners: '0',
        reversedVnd: '0',
        reversedPartners: '0',
        ...commissions,
      },
    ])
    .mockResolvedValueOnce([
      {
        requestedVnd: '0',
        requestedPartners: '0',
        paidVnd: '0',
        paidPartners: '0',
        ...payouts,
      },
    ]);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

describe('PartnersService.adminCommissionSummary (#063)', () => {
  it('should report each stage with the partners behind it', async () => {
    const { service } = buildService(
      {
        pendingVnd: '12400000',
        pendingPartners: '9',
        creditedVnd: '48000000',
        creditedPartners: '21',
        reversedVnd: '3200000',
        reversedPartners: '4',
      },
      {
        requestedVnd: '20000000',
        requestedPartners: '5',
        paidVnd: '75000000',
        paidPartners: '18',
      },
    );

    await expect(service.adminCommissionSummary()).resolves.toEqual({
      pendingConfirmation: { totalVnd: 12_400_000, partners: 9 },
      approvedAwaitingPayout: { totalVnd: 48_000_000, partners: 21 },
      payoutRequested: { totalVnd: 20_000_000, partners: 5 },
      paidThisMonth: { totalVnd: 75_000_000, partners: 18 },
      reversed: { totalVnd: 3_200_000, partners: 4 },
    });
  });

  it('should read "chờ xác nhận" from the 24-hour hold, not from a guess', async () => {
    const { service, query } = buildService();

    await service.adminCommissionSummary();

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['pending', 'credited']);
  });

  it('should count only this month as paid', async () => {
    const { service, query } = buildService();

    await service.adminCommissionSummary();

    const [sql, params] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("date_trunc('month', now())");
    expect(params).toEqual(['pending', 'paid']);
  });

  it('should count a partner once per stage however many rows they have', async () => {
    const { service, query } = buildService();

    await service.adminCommissionSummary();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('COUNT(DISTINCT "partnerId")');
  });

  it('should count only partners who actually had money taken back', async () => {
    // Every commission row has a `reversedCommissionVnd`; most of them are
    // zero, and counting those would report the whole programme as adjusted.
    const { service, query } = buildService();

    await service.adminCommissionSummary();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('COALESCE("reversedCommissionVnd", 0) > 0');
  });

  it('should read an empty programme as zeroes', async () => {
    const { service } = buildService();

    const result = await service.adminCommissionSummary();

    expect(result.pendingConfirmation).toEqual({ totalVnd: 0, partners: 0 });
    expect(result.reversed).toEqual({ totalVnd: 0, partners: 0 });
  });
});
