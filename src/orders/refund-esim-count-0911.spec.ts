import { OrdersService } from './orders.service';

/**
 * doitac-0911 #005 (fixed in doitac-3010 #011, locked here):
 * ORD-261026231605039-QDNN58 had 7 eSIMs refunded 1 + 2 + 4, and the history
 * read "Khách hoàn 3 eSIM" for the last one. Several steps mark eSIMs refunded
 * on the way (the wallet, once the order ends fully refunded), so counting
 * only those still unmarked at the end missed one. The count is the
 * difference of refunded eSIMs before and after.
 */
function build(refundedBefore: number, refundedAfter: number) {
  const query = jest.fn().mockResolvedValue([]);
  const countRefundedEsims = jest
    .fn()
    .mockResolvedValueOnce(refundedBefore)
    .mockResolvedValue(refundedAfter);
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service as unknown as Record<string, unknown>, {
    orderRepository: {
      findById: jest.fn().mockResolvedValue({
        id: 78,
        orderNumber: 'ORD-261026231605039-QDNN58',
        status: 'paid',
        paymentMethod: 'onepay',
        vndPrice: 2534000,
        payableVndPrice: 2534000,
        walletSpentVndAmount: 0,
        refundedAmountVnd: 655591,
      }),
    },
    orderItemsService: {
      findByOrderId: jest.fn().mockResolvedValue([
        {
          id: 98,
          vndPrice: 360000,
          quantity: 2,
          planId: 1,
          status: 'refunded',
        },
        { id: 99, vndPrice: 165000, quantity: 4, planId: 1, status: 'paid' },
        {
          id: 100,
          vndPrice: 1287000,
          quantity: 1,
          planId: 1,
          status: 'refunded',
        },
      ]),
    },
    esimsService: {
      findByOrderItemIds: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    },
    plansService: {
      findById: jest.fn().mockResolvedValue({ provider: 'airalo', name: 'P' }),
    },
    walletsService: { refundOrder: jest.fn().mockResolvedValue({ id: 29 }) },
    partnersService: {},
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    dataSource: { query },
    countRefundedEsims,
    // The wallet already marked all four when the order ended fully
    // refunded, so marking the line finds none left to mark.
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
  return { service, query };
}

describe('eSIMs counted on each refund (doitac-0911 #005)', () => {
  it('should record 4 for the last refund of QDNN58, not 3', async () => {
    const { service, query } = build(3, 7);

    await service.refundOrder(
      78 as never,
      { mode: 'wallet', amountVnd: 165000, orderItemIds: [99] } as never,
      1,
    );

    const update = query.mock.calls.find(([sql]) =>
      /UPDATE order_refund SET "esimCount"/.test(sql as string),
    );
    expect(update?.[1]).toEqual([4, 29]);
  });
});
