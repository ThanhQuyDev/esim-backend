import { OrdersService } from './orders.service';

/**
 * v3 #002 — "Thử bấm hoàn tiền esim của billion cũng chưa thấy gửi lệnh API
 * hoàn tiền qua đối tác". The cancel call was made but its failure swallowed,
 * so the admin saw a clean refund while our money stayed with the supplier.
 */
describe('OrdersService.cancelOrderWithSuppliers — supplier warnings', () => {
  function makeService(cancelOrder: jest.Mock) {
    const service = Object.create(OrdersService.prototype) as OrdersService;
    const internals = service as unknown as Record<string, unknown>;
    internals.orderItemsService = {
      findByOrderId: jest.fn().mockResolvedValue([
        { id: 28, planId: 1, orderRequestId: '2790358537409127' },
        { id: 29, planId: 2, orderRequestId: null },
      ]),
    };
    internals.plansService = {
      findById: jest.fn((id: number) =>
        Promise.resolve(
          id === 1
            ? { provider: 'billion', name: 'Korea 1GB/ngày' }
            : { provider: 'airalo', name: 'Japan 3GB' },
        ),
      ),
    };
    internals.billionService = { cancelOrder };
    internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const cancel = (
      service as unknown as {
        cancelOrderWithSuppliers: (
          orderId: number,
          onlyItemIds?: number[],
        ) => Promise<string[]>;
      }
    ).cancelOrderWithSuppliers.bind(service);
    return { cancel };
  }

  it('should report a supplier that refused to cancel', async () => {
    const cancelOrder = jest
      .fn()
      .mockRejectedValue(new Error('BILLION F008 error: 2003 - used'));
    const { cancel } = makeService(cancelOrder);

    const warnings = await cancel(25);

    expect(cancelOrder).toHaveBeenCalledWith('2790358537409127');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Korea 1GB/ngày');
    expect(warnings[0]).toContain('2003 - used');
  });

  it('should return no warnings when every supplier cancelled', async () => {
    const { cancel } = makeService(jest.fn().mockResolvedValue(undefined));
    await expect(cancel(25)).resolves.toEqual([]);
  });
});
