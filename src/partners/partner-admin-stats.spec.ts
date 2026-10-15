import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * The admin's partner page shows the partner's own dashboard figures over a
 * period the admin picks (doitac-1410 #004).
 */

function buildService(partner: Record<string, unknown>, refunded = 0) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const queries: { sql: string; params: unknown[] }[] = [];
  const getMySummary = jest.fn().mockResolvedValue({
    performance: { clicks: 10, orders: 9, revenueVnd: 900, commissionVnd: 63 },
    commissionPendingVnd: 20,
  });
  const getMyDistributionSummary = jest.fn().mockResolvedValue({
    total: { orders: 4, cancelledOrders: 1, revenueVnd: 400 },
  });
  Object.assign(service, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue(partner),
    getMySummary,
    getMyDistributionSummary,
    getWalletSummaryForPartner: jest.fn().mockResolvedValue({ balanceVnd: 5 }),
    dataSource: {
      query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return Promise.resolve([{ refundedOrders: refunded }]);
      }),
    },
  });
  return { service, queries, getMySummary, getMyDistributionSummary };
}

describe('PartnersService.adminPartnerStats (doitac-1410 #004)', () => {
  it('should read a marketing partner through their own dashboard, for the chosen days', async () => {
    const { service, getMySummary, getMyDistributionSummary } = buildService(
      { id: 3, partnerType: PartnerTypeEnum.KOL },
      1,
    );

    const stats = await service.adminPartnerStats(3, {
      from: '2026-10-01',
      to: '2026-10-15',
    });

    expect(getMySummary).toHaveBeenCalledWith(3, {
      from: '2026-10-01',
      to: '2026-10-15',
    });
    expect(getMyDistributionSummary).not.toHaveBeenCalled();
    expect(stats.distribution).toBeNull();
    // 1 refunded against 9 paid: 10%.
    expect(stats.marketing).toMatchObject({
      commissionPendingVnd: 20,
      refundedOrders: 1,
      refundRatePercent: 10,
    });
  });

  it('should count refunds in the same window', async () => {
    const { service, queries } = buildService({
      id: 3,
      partnerType: PartnerTypeEnum.KOL,
    });

    await service.adminPartnerStats(3, {
      from: '2026-10-01',
      to: '2026-10-01',
    });

    const [, from, to] = queries[0].params as [number, Date, Date];
    expect(to.getTime() - from.getTime()).toBe(24 * 3600 * 1000);
    expect(queries[0].sql).toMatch(/status = 'refunded'/);
  });

  it('should show a distribution partner what they bought, not marketing figures', async () => {
    const { service, getMySummary } = buildService({
      id: 4,
      partnerType: PartnerTypeEnum.DISTRIBUTION,
      canAffiliate: false,
    });

    const stats = await service.adminPartnerStats(4);

    expect(getMySummary).not.toHaveBeenCalled();
    expect(stats.marketing).toBeNull();
    expect(stats.distribution).toMatchObject({ total: { orders: 4 } });
    expect(stats.wallet).toEqual({ balanceVnd: 5 });
  });

  it('should show both when a distribution partner also runs the programme', async () => {
    const { service } = buildService({
      id: 4,
      partnerType: PartnerTypeEnum.DISTRIBUTION,
      canAffiliate: true,
    });

    const stats = await service.adminPartnerStats(4);

    expect(stats.marketing).not.toBeNull();
    expect(stats.distribution).not.toBeNull();
  });
});

describe('PartnersService wallet popup (doitac-1410 #004)', () => {
  function walletService(partner: Record<string, unknown>) {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const find = jest.fn().mockResolvedValue([]);
    const update = jest.fn().mockResolvedValue(undefined);
    Object.assign(service, {
      getPartnerOrThrowById: jest.fn().mockResolvedValue(partner),
      getOrCreateWallet: jest.fn().mockResolvedValue({ id: 9 }),
      getWalletSummaryForPartner: jest.fn().mockResolvedValue({}),
      transactionRepository: { find },
      walletRepository: { update },
    });
    return { service, find, update };
  }

  const typesAsked = (find: jest.Mock) =>
    // TypeORM's In() keeps the list on `_value`.
    (find.mock.calls[0][0].where.type as { _value: string[] })._value;

  it('should list only the admin adjustments for a marketing partner', async () => {
    const { service, find } = walletService({ id: 3, partnerType: 'kol' });

    await service.adminWalletHistory(3);

    expect(typesAsked(find).sort()).toEqual(['manual_credit', 'manual_debit']);
  });

  it('should add the deposits for a distribution partner', async () => {
    const { service, find } = walletService({
      id: 4,
      partnerType: 'distribution',
    });

    await service.adminWalletHistory(4);

    expect(typesAsked(find)).toContain('deposit');
  });

  it('should freeze the wallet on its own', async () => {
    const { service, update } = walletService({ id: 3, status: 'active' });

    await service.setWalletLocked(3, true);

    expect(update).toHaveBeenCalledWith({ id: 9 }, { status: 'locked' });
  });

  it('should not release the wallet of a locked account', async () => {
    const { service, update } = walletService({ id: 3, status: 'hold' });

    await expect(service.setWalletLocked(3, false)).rejects.toThrow(
      'Mở khóa tài khoản',
    );
    expect(update).not.toHaveBeenCalled();
  });
});
