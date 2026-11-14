import { OrdersService } from './orders.service';
import {
  PACING_EMAIL_DEFAULT,
  PACING_FILE_DEFAULT,
  pacingMaxDurationSec,
  pacingRange,
  pacingSchedule,
} from './provision-pacing';

/**
 * vande-1411 #003: a bulk order asked for every eSIM in the same instant and
 * the supplier refused part of them. Each eSIM now has its own moment, a
 * random 10–30 seconds (5–10 for a file) after the one before.
 */
describe('Giãn cách gọi API khi đặt hàng (vande-1411 #003)', () => {
  it('should default to 10–30 seconds for email and 5–10 for a file', () => {
    expect(pacingRange(null, PACING_EMAIL_DEFAULT)).toEqual({
      minSec: 10,
      maxSec: 30,
    });
    expect(pacingRange({}, PACING_FILE_DEFAULT)).toEqual({
      minSec: 5,
      maxSec: 10,
    });
  });

  it('should take what the admin typed, in order and within 0–600', () => {
    expect(
      pacingRange({ minSec: 40, maxSec: 15 }, PACING_EMAIL_DEFAULT),
    ).toEqual({ minSec: 15, maxSec: 40 });
    expect(pacingRange({ minSec: 20 }, PACING_EMAIL_DEFAULT)).toEqual({
      minSec: 20,
      maxSec: 20,
    });
    expect(
      pacingRange({ minSec: -5, maxSec: 9999 }, PACING_EMAIL_DEFAULT),
    ).toEqual({ minSec: 0, maxSec: 600 });
  });

  it('should give the first eSIM the start and each next one a gap in the range', () => {
    const start = new Date('2026-11-14T08:00:00Z');
    let i = 0;
    const randoms = [0, 1, 0.5];
    const times = pacingSchedule(
      4,
      { minSec: 10, maxSec: 30 },
      start,
      () => randoms[i++],
    );
    expect(times.map((t) => (t.getTime() - start.getTime()) / 1000)).toEqual([
      0, 10, 40, 60,
    ]);
  });

  it('should tell the longest it can take', () => {
    expect(pacingMaxDurationSec(10, { minSec: 5, maxSec: 10 })).toBe(90);
    expect(pacingMaxDurationSec(1, { minSec: 5, maxSec: 10 })).toBe(0);
  });

  describe('the dispatcher', () => {
    function build(
      rows: {
        id: number;
        orderId: number;
        at: Date;
        bulkMode: string | null;
      }[],
    ) {
      const service = Object.create(OrdersService.prototype) as OrdersService;
      const submitProviders = jest.fn().mockResolvedValue(undefined);
      const resendEsimEmail = jest.fn().mockResolvedValue({ sent: 1 });
      const pauses: number[] = [];
      Object.assign(service as unknown as Record<string, unknown>, {
        dataSource: { query: jest.fn().mockResolvedValue(rows) },
        submitProviders,
        resendEsimEmail,
        pauseBetweenRetries: jest.fn((ms: number) => {
          pauses.push(ms);
          return Promise.resolve();
        }),
        logger: { log: jest.fn(), error: jest.fn() },
      });
      return { service, submitProviders, resendEsimEmail, pauses };
    }
    const t = (s: number) => new Date(Date.UTC(2026, 10, 14, 8, 0, s));

    it('should ask for each due eSIM on its own and mail it at once', async () => {
      const { service, submitProviders, resendEsimEmail } = build([
        { id: 1, orderId: 9, at: t(0), bulkMode: 'email' },
      ]);
      await service.dispatchPacedProvisioning(t(1));
      expect(submitProviders).toHaveBeenCalledWith(9, {
        onlyItemIds: [1],
        mutedEmail: true,
      });
      expect(resendEsimEmail).toHaveBeenCalledWith(9, {
        onlyOrderItemIds: [1],
      });
    });

    it('should keep the gaps of eSIMs that are already late', async () => {
      const { service, submitProviders, pauses } = build([
        { id: 1, orderId: 9, at: t(0), bulkMode: 'file' },
        { id: 2, orderId: 9, at: t(7), bulkMode: 'file' },
        { id: 3, orderId: 9, at: t(15), bulkMode: 'file' },
      ]);
      await service.dispatchPacedProvisioning(t(30));
      expect(submitProviders).toHaveBeenCalledTimes(3);
      expect(pauses).toEqual([7000, 8000]);
    });

    it('should mail nothing for a file order or a đặt đơn hộ', async () => {
      const { service, resendEsimEmail } = build([
        { id: 1, orderId: 9, at: t(0), bulkMode: 'file' },
        { id: 2, orderId: 10, at: t(0), bulkMode: null },
      ]);
      await service.dispatchPacedProvisioning(t(1));
      expect(resendEsimEmail).not.toHaveBeenCalled();
    });

    it("should not send a line while the admin's button is sending its order", async () => {
      const { service, submitProviders } = build([
        { id: 1, orderId: 9, at: t(0), bulkMode: null },
      ]);
      (
        service as never as { provisionInFlight: Set<number> }
      ).provisionInFlight.add(9);
      await service.dispatchPacedProvisioning(t(1));
      expect(submitProviders).not.toHaveBeenCalled();
    });
  });
});
