import { OrdersService } from './orders.service';

/**
 * vande-0411 #005 — the job that asks suppliers again: it must never run at the
 * same moment as the admin's button on one order, and must not hammer a supplier
 * that just said 429.
 */
const NOW = new Date('2026-11-02T17:00:00Z');

const line = (id: number, orderId: number, provider = 'airalo') => ({
  id,
  orderId,
  provider,
  orderRequestId: null,
  provisionAttempts: 1,
  lastProvisionError: 'Request failed with status code 429',
  lastProvisionAttemptAt: new Date('2026-11-02T16:50:00Z'),
});

function build(lines: unknown[]) {
  const service = Object.create(OrdersService.prototype) as OrdersService;
  const submitProviders = jest.fn().mockResolvedValue(undefined);
  Object.assign(service, {
    submitProviders,
    logger: { log: jest.fn(), error: jest.fn() },
    orderItemsService: {
      findUnplacedForRetry: jest.fn().mockResolvedValue(lines),
    },
    orderRepository: {
      findById: jest.fn((id: number) =>
        Promise.resolve({
          id,
          status: 'paid',
          createdAt: new Date('2026-11-02T16:49:00Z'),
        }),
      ),
    },
  });
  return { service, submitProviders };
}

describe('Tự gọi lại nhà cung cấp (vande-0411 #005)', () => {
  it('should ask for an eSIM that Airalo refused with 429', async () => {
    const { service, submitProviders } = build([line(678, 5)]);

    await service.retryUnplacedProviderItems(NOW);

    expect(submitProviders).toHaveBeenCalledWith(5, { onlyItemIds: [678] });
  });

  it('should ask for at most 5 lines of one supplier per run', async () => {
    const lines = Array.from({ length: 8 }, (_, i) => line(i + 1, i + 1));
    lines.push(line(99, 99, 'billion'));
    lines[8].lastProvisionError = 'BILLION F040 error: 1001 - busy';
    const { service, submitProviders } = build(lines);

    await service.retryUnplacedProviderItems(NOW);

    expect(submitProviders).toHaveBeenCalledTimes(6);
    expect(submitProviders).toHaveBeenCalledWith(99, { onlyItemIds: [99] });
  });

  it("should not send an order while the admin's button is sending it", async () => {
    const { service, submitProviders } = build([line(678, 5)]);
    (
      service as never as { provisionInFlight: Set<number> }
    ).provisionInFlight.add(5);

    await service.retryUnplacedProviderItems(NOW);

    expect(submitProviders).not.toHaveBeenCalled();
  });

  it('should free the order again after a failed run', async () => {
    const { service, submitProviders } = build([line(678, 5)]);
    submitProviders.mockRejectedValueOnce(new Error('boom'));

    await service.retryUnplacedProviderItems(NOW);
    await service.retryUnplacedProviderItems(NOW);

    expect(submitProviders).toHaveBeenCalledTimes(2);
  });
});
