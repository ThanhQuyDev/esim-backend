import { CronExpression } from '@nestjs/schedule';
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

function build(lines: unknown[], afterError: string | null = null) {
  const service = Object.create(OrdersService.prototype) as OrdersService;
  const submitProviders = jest.fn().mockResolvedValue(undefined);
  const pauses: number[] = [];
  Object.assign(service, {
    submitProviders,
    pauseBetweenRetries: jest.fn((ms: number) => {
      pauses.push(ms);
      return Promise.resolve();
    }),
    logger: { log: jest.fn(), error: jest.fn() },
    orderItemsService: {
      findUnplacedForRetry: jest.fn().mockResolvedValue(lines),
      // What the line holds after the call: still refused, or taken.
      findByOrderId: jest.fn((orderId: number) =>
        Promise.resolve(
          (lines as { id: number; orderId: number }[])
            .filter((l) => l.orderId === orderId)
            .map((l) => ({
              id: l.id,
              orderRequestId: afterError ? null : 'REQ',
              lastProvisionError: afterError,
            })),
        ),
      ),
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
  return { service, submitProviders, pauses };
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

  describe('vande-1411 #001', () => {
    it('should send the calls one by one, 10 to 20 seconds apart', async () => {
      const { service, submitProviders, pauses } = build([
        line(1, 1),
        line(2, 1),
        line(3, 2),
      ]);

      await service.retryUnplacedProviderItems(NOW);

      // Two lines of one Airalo order are two calls, not one batch.
      expect(submitProviders).toHaveBeenCalledTimes(3);
      expect(submitProviders).toHaveBeenNthCalledWith(1, 1, {
        onlyItemIds: [1],
      });
      expect(submitProviders).toHaveBeenNthCalledWith(2, 1, {
        onlyItemIds: [2],
      });
      expect(pauses).toHaveLength(2);
      for (const ms of pauses) {
        expect(ms).toBeGreaterThanOrEqual(10_000);
        expect(ms).toBeLessThanOrEqual(20_000);
      }
    });

    it('should leave a supplier alone for the run once it answers 429 again', async () => {
      const lines = [line(1, 1), line(2, 2), line(3, 3, 'billion')];
      lines[2].lastProvisionError = 'BILLION F040 error: 1001 - busy';
      const { service, submitProviders } = build(
        lines,
        'Request failed with status code 429',
      );

      await service.retryUnplacedProviderItems(NOW);

      expect(submitProviders).toHaveBeenCalledWith(1, { onlyItemIds: [1] });
      expect(submitProviders).not.toHaveBeenCalledWith(2, {
        onlyItemIds: [2],
      });
      expect(submitProviders).toHaveBeenCalledWith(3, { onlyItemIds: [3] });
    });

    it('should keep the eSIM Access lines of one order in one call (one transaction id)', async () => {
      const lines = [line(1, 7, 'esimaccess'), line(2, 7, 'esimaccess')];
      const { service, submitProviders } = build(lines);

      await service.retryUnplacedProviderItems(NOW);

      expect(submitProviders).toHaveBeenCalledTimes(1);
      expect(submitProviders).toHaveBeenCalledWith(7, { onlyItemIds: [1, 2] });
    });

    it('should run every minute', () => {
      const meta = Reflect.getMetadata(
        'SCHEDULE_CRON_OPTIONS',
        OrdersService.prototype.retryUnplacedProviderItems,
      ) as { cronTime: string } | undefined;
      expect(meta?.cronTime).toBe(CronExpression.EVERY_MINUTE);
    });
  });
});
