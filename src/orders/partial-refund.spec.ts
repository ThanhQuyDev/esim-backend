import { OrdersService } from './orders.service';

/**
 * Refunding one supplier's line out of a mixed order (#027).
 *
 * The dangerous parts are: cancelling the WHOLE order with every supplier when
 * only one line is being refunded, refunding more than the selected lines were
 * worth, and refunding a line that belongs to somebody else's order.
 */

const ORDER = { id: 7, attributedPartnerId: null };

const ITEMS = [
  { id: 11, vndPrice: 100000, planId: 1 },
  { id: 12, vndPrice: 250000, planId: 2 },
  { id: 13, vndPrice: 50000, planId: 3 },
];

function makeService() {
  const itemUpdates: { id: unknown; payload: Record<string, unknown> }[] = [];
  const cancelled: number[] = [];

  const orderRepository = { findById: jest.fn().mockResolvedValue(ORDER) };
  const orderItemsService = {
    findByOrderId: jest.fn().mockResolvedValue(ITEMS),
    update: jest.fn((id: unknown, payload: Record<string, unknown>) => {
      itemUpdates.push({ id, payload });
      return Promise.resolve(payload);
    }),
  };
  const walletsService = {
    refundOrder: jest.fn().mockResolvedValue({ id: 1 }),
  };

  // Build the instance without the DI container: this test is about the
  // refund rules, not about wiring.
  const service = Object.create(OrdersService.prototype) as OrdersService;
  const internals = service as unknown as Record<string, unknown>;
  internals.orderRepository = orderRepository;
  internals.orderItemsService = orderItemsService;
  internals.walletsService = walletsService;
  internals.partnersService = { reverseCommissionForOrder: jest.fn() };
  internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  // Record which items would be cancelled with their supplier.
  internals.cancelOrderWithSuppliers = jest.fn(
    (_orderId: number, onlyItemIds?: number[]) => {
      cancelled.push(...(onlyItemIds ?? ITEMS.map((i) => i.id)));
      return Promise.resolve();
    },
  );

  return { service, itemUpdates, cancelled, walletsService, orderItemsService };
}

describe('Per-item order refund', () => {
  it('should cancel only the selected line with its supplier', async () => {
    const { service, cancelled } = makeService();

    await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 250000, orderItemIds: [12] } as never,
      1,
    );

    // The other two lines (a different supplier) must be untouched.
    expect(cancelled).toEqual([12]);
  });

  it('should mark only the refunded line, so reporting drops just that line', async () => {
    const { service, itemUpdates } = makeService();

    await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 250000, orderItemIds: [12] } as never,
      1,
    );

    expect(itemUpdates).toHaveLength(1);
    expect(itemUpdates[0].id).toBe(12);
    expect(itemUpdates[0].payload.status).toBe('refunded');
  });

  it('should refuse to refund more than the selected lines are worth', async () => {
    const { service } = makeService();

    await expect(
      service.refundOrder(
        7 as never,
        { mode: 'wallet', amountVnd: 300000, orderItemIds: [12] } as never,
        1,
      ),
    ).rejects.toThrow(/exceeds the value/i);
  });

  it('should refuse an item that belongs to another order', async () => {
    const { service } = makeService();

    await expect(
      service.refundOrder(
        7 as never,
        { mode: 'wallet', amountVnd: 1000, orderItemIds: [99] } as never,
        1,
      ),
    ).rejects.toThrow(/do not belong/i);
  });

  it('should still refund the whole order when no items are picked', async () => {
    const { service, cancelled, itemUpdates } = makeService();

    await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 400000 } as never,
      1,
    );

    // Every supplier cancelled, and no per-line status juggling.
    expect(cancelled).toEqual([11, 12, 13]);
    expect(itemUpdates).toHaveLength(0);
  });
});
