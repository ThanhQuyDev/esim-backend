import { PartnersService } from './partners.service';

/**
 * The four figures at the head of "Tài chính" (#067).
 *
 * Two kinds of money point opposite ways on this page: what is owed out to
 * marketing partners, and what distribution partners have paid in and not yet
 * spent. Both are the finance team's exposure on the partner channel, so both
 * belong in the same header.
 */

function buildService(
  payouts: Record<string, unknown>,
  deposits: Record<string, unknown>,
) {
  const query = jest
    .fn()
    .mockResolvedValueOnce([payouts])
    .mockResolvedValueOnce([deposits]);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

const PAYOUTS = {
  requestedVnd: '12000000',
  requestedPartners: '3',
  paidMonthVnd: '40000000',
  paidMonthPartners: '7',
  paidAllVnd: '512000000',
  paidAllPartners: '26',
};

const DEPOSITS = { totalVnd: '180000000', partners: '9' };

describe('PartnersService.adminPayoutSummary (#067)', () => {
  it('should report what partners have asked to withdraw', async () => {
    const { service } = buildService(PAYOUTS, DEPOSITS);

    const result = await service.adminPayoutSummary();

    expect(result.payoutRequested).toEqual({
      totalVnd: 12_000_000,
      partners: 3,
    });
  });

  it('should keep this month and the running total apart', async () => {
    const { service } = buildService(PAYOUTS, DEPOSITS);

    const result = await service.adminPayoutSummary();

    expect(result.paidThisMonth.totalVnd).toBe(40_000_000);
    // "Lũy kế" is every payout ever made — the figure an accountant
    // reconciles against the bank statement, not a rolling window.
    expect(result.paidAllTime.totalVnd).toBe(512_000_000);
  });

  it('should count the deposit money held for distribution partners', async () => {
    const { service } = buildService(PAYOUTS, DEPOSITS);

    const result = await service.adminPayoutSummary();

    expect(result.distributionDeposit).toEqual({
      totalVnd: 180_000_000,
      partners: 9,
    });
  });

  it('should count a distribution partner who has never topped up', async () => {
    // No wallet row is nothing deposited, not a partner who does not exist.
    const { service, query } = buildService(PAYOUTS, {
      totalVnd: '0',
      partners: '4',
    });

    const result = await service.adminPayoutSummary();

    const [depositSql] = query.mock.calls[1] as [string];
    expect(depositSql).toContain('LEFT JOIN partner_wallet');
    expect(result.distributionDeposit).toEqual({ totalVnd: 0, partners: 4 });
  });

  it('should read an empty programme as zeroes rather than NaN', async () => {
    const { service } = buildService({}, {});

    const result = await service.adminPayoutSummary();

    expect(result).toEqual({
      payoutRequested: { totalVnd: 0, partners: 0 },
      paidThisMonth: { totalVnd: 0, partners: 0 },
      paidAllTime: { totalVnd: 0, partners: 0 },
      distributionDeposit: { totalVnd: 0, partners: 0 },
    });
  });

  it('should leave deleted partners out of the deposit figure', async () => {
    const { service, query } = buildService(PAYOUTS, DEPOSITS);

    await service.adminPayoutSummary();

    const [depositSql] = query.mock.calls[1] as [string];
    expect(depositSql).toContain('p."deletedAt" IS NULL');
  });
});
