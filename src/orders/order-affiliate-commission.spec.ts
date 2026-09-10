import { OrdersService } from './orders.service';

/**
 * Affiliate information on orders (#095, sub-item 1).
 *
 * The order list showed the referral CODE and nothing else: no partner name,
 * no commission, no way to tell an affiliate order from an ordinary one at a
 * glance. Admins reconciling payouts had to cross-reference by hand.
 *
 * The commission row stores dong, never a percentage — the rate moves with the
 * partner's tier — so the share shown is derived from the order's own value.
 */
describe('OrdersService — affiliate commission on orders', () => {
  const COMMISSION = {
    partnerId: 7,
    partnerName: 'Nguyễn Văn A',
    partnerStatus: 'active',
    linkCode: 'VANA2026',
    commissionVnd: 50_000,
    status: 'pending',
    tierSnapshot: 'silver',
    createdAt: new Date(),
  };

  function buildService(commissions: Map<number, typeof COMMISSION>) {
    const partnersService = {
      getCommissionSummariesByOrderIds: jest
        .fn()
        .mockResolvedValue(commissions),
      getCommissionSummaryByOrderId: jest
        .fn()
        .mockImplementation((id: number) =>
          Promise.resolve(commissions.get(id) ?? null),
        ),
    };

    const orders = [
      { id: 1, subtotalVndPrice: 1_000_000, vndPrice: 1_000_000 },
      { id: 2, subtotalVndPrice: 500_000, vndPrice: 500_000 },
    ];

    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      orderRepository: {
        findManyWithPagination: jest
          .fn()
          .mockResolvedValue([orders, orders.length]),
      },
      invoiceRepository: {
        findOrderIdsWithInvoice: jest.fn().mockResolvedValue([]),
      },
      orderItemsService: {
        countByOrderIds: jest.fn().mockResolvedValue(new Map()),
        sumQuantityByOrderIds: jest.fn().mockResolvedValue(new Map()),
      },
      partnersService,
    });

    return { service, partnersService, orders };
  }

  it('should mark an order that came through an affiliate', async () => {
    const { service } = buildService(new Map([[1, COMMISSION]]));

    const [rows] = await service.findManyWithPagination({
      paginationOptions: { page: 1, limit: 10 },
    });

    expect(rows[0].partnerCommission).toMatchObject({
      partnerId: 7,
      partnerName: 'Nguyễn Văn A',
      commissionVnd: 50_000,
      status: 'pending',
    });
  });

  it('should leave an ordinary order without a partner', async () => {
    const { service } = buildService(new Map([[1, COMMISSION]]));

    const [rows] = await service.findManyWithPagination({
      paginationOptions: { page: 1, limit: 10 },
    });

    // Order 2 has no commission row: the badge must not appear for it.
    expect(rows[1].partnerCommission).toBeNull();
  });

  it('should work the share out from the order value', async () => {
    const { service } = buildService(new Map([[1, COMMISSION]]));

    const [rows] = await service.findManyWithPagination({
      paginationOptions: { page: 1, limit: 10 },
    });

    // 50.000đ of a 1.000.000đ order is 5%.
    expect(rows[0].partnerCommission?.commissionPercent).toBe(5);
  });

  it('should ask for the whole page in one query, not one per row', async () => {
    const { service, partnersService, orders } = buildService(new Map());

    await service.findManyWithPagination({
      paginationOptions: { page: 1, limit: 10 },
    });

    expect(
      partnersService.getCommissionSummariesByOrderIds,
    ).toHaveBeenCalledTimes(1);
    expect(
      partnersService.getCommissionSummariesByOrderIds,
    ).toHaveBeenCalledWith(orders.map((o) => o.id));
  });

  it('should never divide by zero on an order with no value', async () => {
    const partnersService = {
      getCommissionSummariesByOrderIds: jest
        .fn()
        .mockResolvedValue(new Map([[1, COMMISSION]])),
    };
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      orderRepository: {
        findManyWithPagination: jest
          .fn()
          .mockResolvedValue([
            [{ id: 1, subtotalVndPrice: 0, vndPrice: 0 }],
            1,
          ]),
      },
      invoiceRepository: {
        findOrderIdsWithInvoice: jest.fn().mockResolvedValue([]),
      },
      orderItemsService: {
        countByOrderIds: jest.fn().mockResolvedValue(new Map()),
        sumQuantityByOrderIds: jest.fn().mockResolvedValue(new Map()),
      },
      partnersService,
    });

    const [rows] = await service.findManyWithPagination({
      paginationOptions: { page: 1, limit: 10 },
    });

    expect(rows[0].partnerCommission?.commissionPercent).toBe(0);
  });
});
