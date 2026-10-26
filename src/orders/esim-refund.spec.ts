import { OrdersService } from './orders.service';

/**
 * Refunding single eSIMs (ICCIDs) of a line bought in several copies (#008,
 * test round 4): China 1GB / 7 days, 3 bought for 2 people — the spare one is
 * refunded on its own, the other two keep working.
 */

const ORDER = { id: 7, attributedPartnerId: null };

/** One line, 3 eSIMs at 100 000đ each; one more line of another supplier. */
const ITEMS = [
  { id: 11, vndPrice: 300000, quantity: 3, planId: 1 },
  { id: 12, vndPrice: 50000, quantity: 1, planId: 2 },
];

function makeService(esimStatuses: Record<number, string> = {}) {
  const esims = [
    { id: 101, orderItemId: 11, iccid: '8901', esimTranNo: 'T1' },
    { id: 102, orderItemId: 11, iccid: '8902', esimTranNo: 'T2' },
    { id: 103, orderItemId: 11, iccid: '8903', esimTranNo: 'T3' },
    { id: 104, orderItemId: 12, iccid: '8904', esimTranNo: 'T4' },
  ].map((e) => ({ ...e, status: esimStatuses[e.id] ?? 'sold' }));

  const itemUpdates: number[] = [];
  const cancelledEsims: string[] = [];
  const wholeLineCancels: unknown[] = [];

  const service = Object.create(OrdersService.prototype) as OrdersService;
  const internals = service as unknown as Record<string, unknown>;
  internals.orderRepository = { findById: jest.fn().mockResolvedValue(ORDER) };
  internals.orderItemsService = {
    findByOrderId: jest.fn().mockResolvedValue(ITEMS),
    update: jest.fn((id: number) => {
      itemUpdates.push(id);
      return Promise.resolve({});
    }),
  };
  internals.esimsService = {
    findByOrderItemIds: jest.fn((ids: number[]) =>
      Promise.resolve(esims.filter((e) => ids.includes(e.orderItemId))),
    ),
    update: jest.fn((id: number, payload: { status?: string }) => {
      const esim = esims.find((e) => e.id === id);
      if (esim && payload.status) esim.status = payload.status;
      return Promise.resolve({});
    }),
  };
  internals.plansService = {
    findById: jest.fn((id: number) =>
      Promise.resolve(
        id === 1
          ? { provider: 'esimaccess', isLocalInventory: false }
          : { provider: 'billion', isLocalInventory: false },
      ),
    ),
  };
  internals.esimAccessService = {
    cancelEsim: jest.fn((tranNo: string) => {
      cancelledEsims.push(tranNo);
      return Promise.resolve();
    }),
  };
  internals.walletsService = {
    refundOrder: jest.fn().mockResolvedValue({ id: 1 }),
  };
  internals.partnersService = { reverseCommissionForOrder: jest.fn() };
  internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  internals.cancelOrderWithSuppliers = jest.fn((...args: unknown[]) => {
    wholeLineCancels.push(args);
    return Promise.resolve([]);
  });

  return { service, esims, itemUpdates, cancelledEsims, wholeLineCancels };
}

describe('Per-eSIM (ICCID) refund', () => {
  it('should cancel only the picked eSIM and never the whole order', async () => {
    const { service, cancelledEsims, wholeLineCancels, esims, itemUpdates } =
      makeService();

    await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 100000, esimIds: [103] } as never,
      1,
    );

    expect(wholeLineCancels).toEqual([]);
    expect(cancelledEsims).toEqual(['T3']);
    expect(esims.find((e) => e.id === 103)?.status).toBe('refunded');
    expect(esims.find((e) => e.id === 101)?.status).toBe('sold');
    // Two eSIMs of the line are still in use, so the line is not refunded.
    expect(itemUpdates).toEqual([]);
  });

  it('should value an eSIM at its line unit price', async () => {
    const { service } = makeService();

    await expect(
      service.refundOrder(
        7 as never,
        { mode: 'wallet', amountVnd: 100001, esimIds: [103] } as never,
        1,
      ),
    ).rejects.toThrow(/exceeds the value/i);
  });

  it('should mark the line refunded once its last eSIM is', async () => {
    const { service, itemUpdates } = makeService({
      101: 'refunded',
      102: 'refunded',
    });

    await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 100000, esimIds: [103] } as never,
      1,
    );

    expect(itemUpdates).toEqual([11]);
  });

  it('should refuse an eSIM that was already refunded', async () => {
    const { service } = makeService({ 103: 'refunded' });

    await expect(
      service.refundOrder(
        7 as never,
        { mode: 'wallet', amountVnd: 100000, esimIds: [103] } as never,
        1,
      ),
    ).rejects.toThrow(/already refunded/i);
  });

  it('should refuse an eSIM of another order', async () => {
    const { service } = makeService();

    await expect(
      service.refundOrder(
        7 as never,
        { mode: 'wallet', amountVnd: 1000, esimIds: [999] } as never,
        1,
      ),
    ).rejects.toThrow(/do not belong/i);
  });

  it('should ask Billion to take back a single eSIM (vande #004)', async () => {
    const { service } = makeService();
    const requestAfterSale = jest.fn().mockResolvedValue('AS1');
    Object.assign(service, {
      billionService: {
        afterSaleReason: jest.fn().mockResolvedValue('20'),
        requestAfterSale,
      },
      dataSource: { query: jest.fn().mockResolvedValue([]) },
      addOrderNote: jest.fn().mockResolvedValue({}),
    });

    const result = (await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 50000, esimIds: [104] } as never,
      1,
    )) as { supplierWarnings: string[]; supplierRequests: string[] };

    // Billion takes single eSIMs back by after-sale request (F017), so there
    // is no "settle it with the supplier by hand" warning any more.
    expect(requestAfterSale).toHaveBeenCalledWith(
      expect.objectContaining({ iccids: ['8904'] }),
    );
    expect(result.supplierWarnings).toEqual([]);
    expect(result.supplierRequests).toEqual([
      expect.stringContaining('#AS1 cho ICCID 8904'),
    ]);
  });
});

describe('Refund eSIM count (doitac-1410 #020)', () => {
  it('should record how many eSIMs each refund gave back', async () => {
    const { service } = makeService({ 101: 'refunded' });
    const query = jest.fn().mockResolvedValue([]);
    (service as unknown as Record<string, unknown>).dataSource = { query };

    await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 100000, esimIds: [103] } as never,
      1,
    );
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('"esimCount"'),
      [1, 1],
    );

    // The whole line: only the two eSIMs not refunded before count.
    query.mockClear();
    await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 1000, orderItemIds: [11] } as never,
      1,
    );
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('"esimCount"'),
      [1, 1],
    );
  });
});
