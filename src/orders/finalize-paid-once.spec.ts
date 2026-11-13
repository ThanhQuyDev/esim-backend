import { OrdersService } from './orders.service';

/**
 * SECURITY 12/11/2026 — the signed OnePay parameters come back to the buyer
 * on the return URL; replaying them at once provisioned the order once per
 * request. Only the call that moves the order out of `pending` may go on.
 */
function makeService(rowsReturned: unknown) {
  const service = Object.create(OrdersService.prototype) as OrdersService;
  const query = jest.fn().mockResolvedValue(rowsReturned);
  const completePaidOrderBenefits = jest.fn();
  Object.assign(service as unknown as Record<string, unknown>, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    dataSource: { query },
    findById: jest.fn().mockResolvedValue({ id: 5, attributedPartnerId: null }),
    walletsService: { completePaidOrderBenefits },
    sendInvoiceEmailIfRequested: jest.fn(),
  });
  return { service, query, completePaidOrderBenefits };
}

describe('finalizePaidOrder: paid once only', () => {
  it('should pay a pending order once, in one conditional statement', async () => {
    const { service, query, completePaidOrderBenefits } = makeService([
      [{ id: 5 }],
      1,
    ]);

    const order = await service.finalizePaidOrder(5, {
      paymentMethod: 'onepay',
      paymentId: 'T1',
    });

    expect(order).toMatchObject({ id: 5 });
    expect(query.mock.calls[0][0]).toContain(`status = 'pending'`);
    expect(completePaidOrderBenefits).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when the order is no longer pending', async () => {
    const { service, completePaidOrderBenefits } = makeService([[], 0]);

    const order = await service.finalizePaidOrder(5, {
      paymentMethod: 'onepay',
      paymentId: 'T1',
    });

    expect(order).toBeNull();
    expect(completePaidOrderBenefits).not.toHaveBeenCalled();
  });
});
