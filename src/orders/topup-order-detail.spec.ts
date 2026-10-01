import { OrdersService } from './orders.service';

/**
 * #015 — a topup order detail has to say what the package gave, what it cost, and
 * which eSIM it was applied to, so the result can be reconciled.
 */
describe('Topup detail on an order (#015)', () => {
  function makeService(opts: {
    order: Record<string, unknown>;
    esim?: Record<string, unknown> | null;
    plan?: { name: string } | null;
    orderItem?: { orderId: number } | null;
  }) {
    const service = Object.create(OrdersService.prototype) as OrdersService;
    const internals = service as unknown as Record<string, unknown>;
    internals.esimsService = {
      findByIccid: jest.fn().mockResolvedValue(opts.esim ?? null),
    };
    internals.plansService = {
      findById: jest.fn().mockResolvedValue(opts.plan ?? null),
    };
    internals.orderItemsService = {
      findById: jest.fn().mockResolvedValue(opts.orderItem ?? null),
    };
    return {
      service,
      build: () =>
        (
          service as unknown as {
            buildTopupDetail: (order: unknown) => Promise<unknown>;
          }
        ).buildTopupDetail(opts.order),
    };
  }

  const TOPUP_ORDER = {
    orderType: 'TOPUP',
    targetIccid: '89852245280001354019',
    topupProvider: 'AIRALO',
    topupPackageId: 'bonbon-mobile-30days-3gb-topup',
    topupPackageName: '3 GB - 100 SMS - 100 Mins - 30 Days',
    topupDataText: '3 GB',
    topupDurationDays: 30,
    topupIsUnlimited: false,
  };

  it('should returns null for an ordinary purchase', async () => {
    const { build } = makeService({ order: { orderType: 'BUY_NEW' } });
    await expect(build()).resolves.toBeNull();
  });

  it('should returns null for a topup order with no target iccid', async () => {
    const { build } = makeService({
      order: { orderType: 'TOPUP', targetIccid: null },
    });
    await expect(build()).resolves.toBeNull();
  });

  it('should reports the package snapshot stored at checkout', async () => {
    const { build } = makeService({ order: TOPUP_ORDER });

    await expect(build()).resolves.toMatchObject({
      targetIccid: '89852245280001354019',
      provider: 'AIRALO',
      packageName: '3 GB - 100 SMS - 100 Mins - 30 Days',
      dataText: '3 GB',
      durationDays: 30,
      isUnlimited: false,
    });
  });

  it('should attaches the eSIM being topped up, its plan and its original order', async () => {
    const expiresAt = new Date('2026-10-30T00:00:00.000Z');
    const { build } = makeService({
      order: TOPUP_ORDER,
      esim: {
        id: 42,
        iccid: '89852245280001354019',
        status: 'sold',
        provider: 'airalo',
        planId: 7,
        orderItemId: 99,
        dataUsed: '500MB',
        dataTotal: '3GB',
        expiresAt,
        activatedAt: null,
      },
      plan: { name: 'Japan 3GB / 30 days' },
      orderItem: { orderId: 5 },
    });

    await expect(build()).resolves.toMatchObject({
      targetEsim: {
        id: 42,
        status: 'sold',
        planName: 'Japan 3GB / 30 days',
        dataUsed: '500MB',
        dataTotal: '3GB',
        expiresAt,
        originalOrderId: 5,
      },
    });
  });

  it('should still reports the package when the iccid matches no eSIM we hold', async () => {
    // The customer may have mistyped the ICCID; the order still has to be
    // readable, with the target left null rather than the whole card missing.
    const { build } = makeService({ order: TOPUP_ORDER, esim: null });

    const detail = (await build()) as {
      targetEsim: unknown;
      packageName: string;
    };
    expect(detail.targetEsim).toBeNull();
    expect(detail.packageName).toBe('3 GB - 100 SMS - 100 Mins - 30 Days');
  });

  it('should does not invent an original order when the eSIM has no order item', async () => {
    const { build } = makeService({
      order: TOPUP_ORDER,
      esim: {
        id: 42,
        iccid: '89852245280001354019',
        status: 'available',
        provider: 'viettel',
        planId: null,
        orderItemId: null,
      },
    });

    await expect(build()).resolves.toMatchObject({
      targetEsim: { planName: null, originalOrderId: null },
    });
  });
});
