import { OrdersService } from './orders.service';
import { PartnersService } from '../partners/partners.service';

/**
 * doitac-0911 #001 — PTN-261104004736115-O6YPBE on beta: 5 Airalo lines, 2
 * answered 429. The checkout refunded those 2 to the deposit wallet at once;
 * the partner then pressed "Gọi lại API lấy eSIM", both eSIMs came, so the
 * partner held the eSIMs and the money. An admin then refunded one of them
 * from the order screen, which paid 359.000đ into the eXU wallet of the
 * partner's user account instead of the deposit wallet.
 *
 * Pinned here: a line whose money went back is never asked again, and an
 * admin refund of a partner's order lands in the deposit wallet.
 */

function retryService(items: { id: number; status: string }[]) {
  const submitted: number[][] = [];
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service as unknown as Record<string, unknown>, {
    orderRepository: {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 107, orderNumber: 'PTN-X', status: 'paid' }),
    },
    orderItemsService: {
      findByOrderId: jest
        .fn()
        .mockResolvedValue(items.map((i) => ({ ...i, orderRequestId: null }))),
    },
    esimsService: { findByOrderItemIds: jest.fn().mockResolvedValue([]) },
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    submitProviders: jest.fn(
      (_id: number, options?: { onlyItemIds?: number[] }) => {
        submitted.push(options?.onlyItemIds ?? []);
        return Promise.resolve();
      },
    ),
    resendEsimEmail: jest.fn().mockResolvedValue({ sent: 0 }),
  });
  return { service, submitted };
}

describe('Retry of a partner line whose money went back (doitac-0911 #001)', () => {
  it('should not ask the supplier again for a refunded or failed line', async () => {
    const { service, submitted } = retryService([
      { id: 136, status: 'failed' },
      { id: 137, status: 'refunded' },
    ]);

    const result = await service.retryProvisioning(107);

    expect(result.retriedItemIds).toEqual([]);
    expect(result.skippedItemIds).toEqual([136, 137]);
    expect(submitted).toHaveLength(0);
    expect(result.message).toContain('đã hoàn tiền');
  });

  it('should still ask again for a line left pending', async () => {
    const { service, submitted } = retryService([
      { id: 136, status: 'pending' },
      { id: 137, status: 'failed' },
    ]);

    const result = await service.retryProvisioning(107);

    expect(result.retriedItemIds).toEqual([136]);
    expect(submitted).toEqual([[136]]);
  });
});

function refundService(order: Record<string, unknown>, room: unknown) {
  const walletsService = {
    refundOrder: jest.fn().mockResolvedValue({ id: 33 }),
  };
  const partnersService = {
    partnerPurchaseRefundRoom: jest.fn().mockResolvedValue(room),
    refundWalletForPurchase: jest.fn().mockResolvedValue(undefined),
    reverseCommissionForOrder: jest.fn(),
  };
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service as unknown as Record<string, unknown>, {
    orderRepository: { findById: jest.fn().mockResolvedValue(order) },
    orderItemsService: {
      findByOrderId: jest
        .fn()
        .mockResolvedValue([
          { id: 137, vndPrice: 359000, quantity: 1, planId: 1 },
        ]),
      update: jest.fn().mockResolvedValue(undefined),
    },
    esimsService: {
      findByOrderItemIds: jest
        .fn()
        .mockResolvedValue([{ id: 343, orderItemId: 137, status: 'sold' }]),
      update: jest.fn().mockResolvedValue(undefined),
    },
    plansService: {
      findById: jest.fn().mockResolvedValue({ provider: 'airalo', name: 'P' }),
    },
    walletsService,
    partnersService,
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    dataSource: { query: jest.fn().mockResolvedValue([]) },
    countRefundedEsims: jest.fn().mockResolvedValue(0),
    markRefundedEsims: jest.fn().mockResolvedValue(0),
    markItemRefunded: jest.fn().mockResolvedValue(undefined),
    cancelOrderWithSuppliers: jest.fn().mockResolvedValue([]),
    cancelEsimsWithSuppliers: jest.fn().mockResolvedValue([]),
    requestBillionRefunds: jest
      .fn()
      .mockResolvedValue({ requests: [], warnings: [] }),
    refundLinkedTopups: jest
      .fn()
      .mockResolvedValue({ requests: [], warnings: [] }),
  });
  return { service, walletsService, partnersService };
}

const PARTNER_ORDER = {
  id: 107,
  orderNumber: 'PTN-261104004736115-O6YPBE',
  status: 'paid',
  paymentMethod: 'partner_wallet',
  vndPrice: 4920000,
  payableVndPrice: 4920000,
  walletSpentVndAmount: 0,
  refundedAmountVnd: 0,
};

describe("Admin refund of a partner's order (doitac-0911 #001)", () => {
  it('should pay the deposit wallet, not the eXU wallet', async () => {
    const { service, walletsService, partnersService } = refundService(
      PARTNER_ORDER,
      { partnerId: 11, remainingVnd: 4329000 },
    );

    await service.refundOrder(
      107 as never,
      {
        mode: 'wallet',
        amountVnd: 359000,
        orderItemIds: [137],
        reason: 'admin đồng ý hoàn tiền',
      } as never,
      1,
    );

    expect(walletsService.refundOrder.mock.calls[0][1].mode).toBe(
      'partner_wallet',
    );
    expect(partnersService.refundWalletForPurchase).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        orderId: 107,
        amountVnd: 359000,
        suffix: 'order-refund:33',
        createdByAdminId: 1,
      }),
    );
  });

  it('should refuse more than the deposit wallet has not had back', async () => {
    const { service, walletsService, partnersService } = refundService(
      PARTNER_ORDER,
      { partnerId: 11, remainingVnd: 100000 },
    );

    await expect(
      service.refundOrder(
        107 as never,
        { mode: 'wallet', amountVnd: 359000, orderItemIds: [137] } as never,
        1,
      ),
    ).rejects.toThrow('vượt số còn lại');
    expect(walletsService.refundOrder).not.toHaveBeenCalled();
    expect(partnersService.refundWalletForPurchase).not.toHaveBeenCalled();
  });

  it("should not let a customer's order be refunded into a deposit wallet", async () => {
    const { service, walletsService } = refundService(
      { ...PARTNER_ORDER, paymentMethod: 'onepay' },
      null,
    );

    await expect(
      service.refundOrder(
        107 as never,
        {
          mode: 'partner_wallet',
          amountVnd: 359000,
          orderItemIds: [137],
        } as never,
        1,
      ),
    ).rejects.toThrow('ví ký quỹ');
    expect(walletsService.refundOrder).not.toHaveBeenCalled();
  });
});

describe('PartnersService.purchaseRetryLines (doitac-0911 #001)', () => {
  const lines = (rows: Record<string, unknown>[]) => {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service as unknown as Record<string, unknown>, {
      dataSource: { query: jest.fn().mockResolvedValue(rows) },
    });
    return service.purchaseRetryLines(107);
  };
  const base = {
    quantity: 1,
    orderRequestId: null,
    lastProvisionError: 'Request failed with status code 429',
    provisionAttempts: 1,
    status: 'paid',
    provider: 'airalo',
    delivered: 0,
  };

  it('should offer the retry and say when the system asks again', async () => {
    const last = new Date(Date.now() - 60_000);
    const [line] = await lines([
      {
        ...base,
        id: 136,
        itemStatus: 'pending',
        createdAt: new Date(Date.now() - 120_000),
        lastProvisionAttemptAt: last,
      },
    ]);

    expect(line.canRetry).toBe(true);
    expect(line.attempts).toBe(1);
    expect(line.nextRetryAt).toBe(
      new Date(last.getTime() + 4 * 60_000).toISOString(),
    );
  });

  it('should not offer the retry on a line already refunded', async () => {
    const [line] = await lines([
      {
        ...base,
        id: 136,
        itemStatus: 'failed',
        createdAt: new Date(),
        lastProvisionAttemptAt: new Date(),
      },
    ]);

    expect(line.canRetry).toBe(false);
    expect(line.nextRetryAt).toBeNull();
  });
});
