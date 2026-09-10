import { TopupService } from './topup.service';
import { TopupProvider } from './dto/topup-package.dto';
import { ADMIN_MANUAL_PAYMENT_METHOD } from './topup.constants';

/**
 * An admin topping a customer's eSIM up without charging through a gateway
 * (#026). The risk here is a back door: this path must keep every guard the
 * paying path has, must bill the CUSTOMER's account rather than the admin's,
 * and must leave a trace that the money never came through a gateway.
 */

const ICCID = '89852245280001354019';

function makeService(opts: {
  esim?: Record<string, unknown> | null;
  packages?: Record<string, unknown>[];
  executeResultStatus?: string;
}) {
  const orderUpdates: { id: unknown; payload: Record<string, unknown> }[] = [];
  let createdOrder: Record<string, unknown> | null = null;

  const orderRepository = {
    create: jest.fn((payload: Record<string, unknown>) => {
      createdOrder = { id: 1, ...payload };
      return Promise.resolve(createdOrder);
    }),
    update: jest.fn((id: unknown, payload: Record<string, unknown>) => {
      orderUpdates.push({ id, payload });
      return Promise.resolve(payload);
    }),
    findByOrderNumber: jest.fn(() =>
      Promise.resolve({
        ...(createdOrder ?? {}),
        status: opts.executeResultStatus ?? 'completed',
      }),
    ),
  };

  const esimsService = {
    findByIccid: jest
      .fn()
      .mockResolvedValue(
        opts.esim === undefined
          ? { id: 10, userId: 77, provider: 'airalo', planId: 3 }
          : opts.esim,
      ),
  };

  const service = new TopupService(
    orderRepository as never,
    esimsService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  jest.spyOn(service, 'listPackages').mockResolvedValue({
    iccid: ICCID,
    provider: TopupProvider.AIRALO,
    packages: (opts.packages ?? [
      { packageId: 'pkg-1', retailPrice: 5, vndPrice: 130000 },
    ]) as never,
  });
  jest.spyOn(service, 'executeTopup').mockResolvedValue(undefined);

  return { service, orderRepository, orderUpdates, esimsService };
}

describe('Admin manual topup (payment gateway bypassed)', () => {
  it('should bill the eSIM owner, not the admin who granted it', async () => {
    const { service, orderRepository } = makeService({});

    await service.adminManualTopup(
      { iccid: ICCID, packageId: 'pkg-1', provider: TopupProvider.AIRALO },
      999,
    );

    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 77 }),
    );
  });

  it('should mark the order paid without a gateway, and say so', async () => {
    const { service, orderUpdates } = makeService({});

    await service.adminManualTopup(
      {
        iccid: ICCID,
        packageId: 'pkg-1',
        provider: TopupProvider.AIRALO,
        note: 'Khách chuyển khoản trực tiếp',
      },
      999,
    );

    expect(orderUpdates).toHaveLength(1);
    expect(orderUpdates[0].payload.status).toBe('paid');
    // Distinguishable from real OnePay / bank-transfer money at reconciliation.
    expect(orderUpdates[0].payload.paymentMethod).toBe(
      ADMIN_MANUAL_PAYMENT_METHOD,
    );
    // Who did it and why, in place of the missing gateway reference.
    expect(String(orderUpdates[0].payload.paymentId)).toContain('admin:999');
    expect(String(orderUpdates[0].payload.paymentId)).toContain(
      'Khách chuyển khoản trực tiếp',
    );
  });

  it('should run the provider call and report the real outcome', async () => {
    const { service } = makeService({ executeResultStatus: 'completed' });

    const result = await service.adminManualTopup(
      { iccid: ICCID, packageId: 'pkg-1', provider: TopupProvider.AIRALO },
      1,
    );

    expect(service.executeTopup).toHaveBeenCalledWith(result.orderNumber);
    expect(result.success).toBe(true);
    expect(result.status).toBe('completed');
  });

  it('should report failure rather than pretend it worked', async () => {
    const { service } = makeService({
      executeResultStatus: 'MANUAL_INTERVENTION',
    });

    const result = await service.adminManualTopup(
      { iccid: ICCID, packageId: 'pkg-1', provider: TopupProvider.AIRALO },
      1,
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe('MANUAL_INTERVENTION');
  });

  it('should refuse an unknown eSIM', async () => {
    const { service } = makeService({ esim: null });

    await expect(
      service.adminManualTopup(
        { iccid: ICCID, packageId: 'pkg-1', provider: TopupProvider.AIRALO },
        1,
      ),
    ).rejects.toThrow(/not found/i);
  });

  it('should refuse an eSIM that belongs to nobody', async () => {
    const { service } = makeService({
      esim: { id: 10, userId: null, provider: 'airalo' },
    });

    await expect(
      service.adminManualTopup(
        { iccid: ICCID, packageId: 'pkg-1', provider: TopupProvider.AIRALO },
        1,
      ),
    ).rejects.toThrow(/not owned/i);
  });

  it('should refuse a package that is not offered for this eSIM', async () => {
    const { service } = makeService({ packages: [] });

    await expect(
      service.adminManualTopup(
        { iccid: ICCID, packageId: 'made-up', provider: TopupProvider.AIRALO },
        1,
      ),
    ).rejects.toThrow();
  });
});
