import { OrdersService } from './orders.service';

/**
 * "Gọi lại API lấy eSIM" (#030) — used when the deposit with a supplier ran
 * dry mid-order and only some lines came back with an eSIM.
 *
 * The danger is the opposite of the feature: `submitProviders` buys an eSIM for
 * every line it is handed, so a careless retry would pay for a SECOND eSIM on
 * every line that already worked. These tests pin exactly which lines are
 * re-sent.
 */
function makeService(opts: {
  orderStatus?: string;
  items: { id: number; orderRequestId?: string | null }[];
  esims: { orderItemId: number }[];
}) {
  const submitted: { orderId: number; onlyItemIds?: number[] }[] = [];

  const orderRepository = {
    findById: jest.fn().mockResolvedValue({
      id: 5,
      orderNumber: 'ORD-5',
      status: opts.orderStatus ?? 'paid',
    }),
  };
  const orderItemsService = {
    findByOrderId: jest.fn().mockResolvedValue(opts.items),
  };
  const esimsService = {
    findByOrderItemIds: jest.fn().mockResolvedValue(opts.esims),
  };

  const service = Object.create(OrdersService.prototype) as OrdersService;
  const internals = service as unknown as Record<string, unknown>;
  internals.orderRepository = orderRepository;
  internals.orderItemsService = orderItemsService;
  internals.esimsService = esimsService;
  internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  internals.submitProviders = jest.fn(
    (orderId: number, options?: { onlyItemIds?: number[] }) => {
      submitted.push({ orderId, onlyItemIds: options?.onlyItemIds });
      return Promise.resolve();
    },
  );

  return { service, submitted };
}

describe('Retry provisioning for an order', () => {
  it('should re-send only the line that never got an eSIM', async () => {
    const { service, submitted } = makeService({
      items: [
        { id: 1, orderRequestId: 'REF-1' }, // delivered
        { id: 2, orderRequestId: null }, // supplier refused — retry this one
      ],
      esims: [{ orderItemId: 1 }],
    });

    const result = await service.retryProvisioning(5);

    expect(result.retriedItemIds).toEqual([2]);
    expect(result.skippedItemIds).toEqual([1]);
    expect(submitted).toEqual([{ orderId: 5, onlyItemIds: [2] }]);
  });

  it('should never re-order a line that already has an eSIM', async () => {
    const { service, submitted } = makeService({
      items: [{ id: 1, orderRequestId: null }],
      // No provider reference, but the eSIM did arrive — buying another one
      // would cost real money and hand the customer a duplicate.
      esims: [{ orderItemId: 1 }],
    });

    const result = await service.retryProvisioning(5);

    expect(result.retriedItemIds).toEqual([]);
    expect(submitted).toHaveLength(0);
  });

  it('should leave a line the supplier already accepted alone', async () => {
    const { service, submitted } = makeService({
      // Airalo / Billion / MicroEsim deliver by webhook: accepted, eSIM still
      // on its way. Re-sending would place a second order.
      items: [{ id: 1, orderRequestId: 'REF-1' }],
      esims: [],
    });

    const result = await service.retryProvisioning(5);

    expect(result.retriedItemIds).toEqual([]);
    expect(submitted).toHaveLength(0);
  });

  it('should say plainly when there is nothing to retry', async () => {
    const { service } = makeService({
      items: [{ id: 1, orderRequestId: 'REF-1' }],
      esims: [{ orderItemId: 1 }],
    });

    const result = await service.retryProvisioning(5);

    expect(result.message).toMatch(/Không có sản phẩm nào cần gọi lại/);
  });

  it('should refuse an order that has not been paid', async () => {
    const { service } = makeService({
      orderStatus: 'pending',
      items: [{ id: 1, orderRequestId: null }],
      esims: [],
    });

    await expect(service.retryProvisioning(5)).rejects.toThrow(
      /only a paid order/i,
    );
  });
});
