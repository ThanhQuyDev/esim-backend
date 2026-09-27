import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * Top-ups are not the partner's business (#025).
 *
 * A partner earns for bringing a customer who buys an eSIM. When that customer
 * later tops the same eSIM up, nobody referred anything — so no commission, and
 * the transaction does not belong in the partner's order list or reports either.
 */

describe('PartnersService — top-up orders (#025)', () => {
  it('should create no commission for a top-up order', async () => {
    const save = jest.fn();
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      logger: { warn: jest.fn() },
      partnerRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 5,
          userId: 9,
          partnerType: PartnerTypeEnum.KOL,
          tierCode: 'GOLD',
        }),
      },
      tierRepository: {
        findOne: jest.fn().mockResolvedValue({ commissionPercent: 20 }),
      },
      commissionRepository: { create: (row: unknown) => row, save },
    });

    await expect(
      service.createPendingCommissionForOrder({
        orderId: 77,
        partnerId: 5,
        linkId: 11,
        orderValueVnd: 500_000,
        buyerUserId: 42,
        orderType: 'TOPUP',
      }),
    ).resolves.toBeNull();

    expect(save).not.toHaveBeenCalled();
  });

  it('should still pay commission on a normal purchase', async () => {
    const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      logger: { warn: jest.fn() },
      partnerRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 5,
          userId: 9,
          partnerType: PartnerTypeEnum.KOL,
          tierCode: 'GOLD',
        }),
      },
      tierRepository: {
        findOne: jest.fn().mockResolvedValue({ commissionPercent: 20 }),
      },
      commissionRepository: { create: (row: unknown) => row, save },
    });

    await service.createPendingCommissionForOrder({
      orderId: 78,
      partnerId: 5,
      linkId: 11,
      orderValueVnd: 500_000,
      buyerUserId: 42,
      orderType: 'BUY_NEW',
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ commissionVnd: 100_000 }),
    );
  });

  it('should keep top-ups out of the order list and the figures built from it', async () => {
    const sql: string[] = [];
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      getPartnerOrThrowById: jest.fn().mockResolvedValue({
        id: 5,
        partnerType: PartnerTypeEnum.KOL,
        tierCode: null,
      }),
      dataSource: {
        query: jest.fn((query: string) => {
          sql.push(query);
          return Promise.resolve([{}]);
        }),
      },
      getWalletSummaryForPartner: jest.fn().mockResolvedValue({}),
      tierRepository: { find: jest.fn().mockResolvedValue([]) },
    });

    await service.getMyOrders(5);
    await service.getMySummary(5);
    await service.getMyTopDestinations(5);

    // Every query that reads orders filters them out; leaving one behind would
    // make the list and its own totals disagree. (The click log has no orders
    // in it, so it is not one of them.)
    const orderQueries = sql.filter((q) => q.includes('FROM "order"'));
    expect(orderQueries.length).toBeGreaterThanOrEqual(4);
    for (const query of orderQueries) {
      expect(query).toContain(`o."orderType" <> 'TOPUP'`);
    }
  });
});
