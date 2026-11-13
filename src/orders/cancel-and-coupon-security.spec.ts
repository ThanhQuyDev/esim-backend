import { In } from 'typeorm';
import { OrdersService } from './orders.service';
import { CouponsService } from '../coupons/coupons.service';

/** SECURITY 12/11/2026 — cancel racing payment; coupon limits. */
describe('cancelOrder (security 12/11/2026)', () => {
  function makeService(claimed: boolean) {
    const service = Object.create(OrdersService.prototype) as OrdersService;
    const releaseHoldForOrder = jest.fn();
    const releaseCoupon = jest.fn();
    Object.assign(service as unknown as Record<string, unknown>, {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      orderRepository: {
        findById: jest.fn().mockResolvedValue({
          id: 5,
          userId: 9,
          status: 'pending',
          couponCode: 'HELLO',
          orderNumber: 'ORD-5',
        }),
      },
      claimPendingOrder: jest.fn().mockResolvedValue(claimed),
      walletsService: {
        releaseHoldForOrder,
        reversePendingReferralForOrder: jest.fn(),
      },
      couponsService: { releaseCoupon },
    });
    return { service, releaseHoldForOrder, releaseCoupon };
  }

  it('should give nothing back when the payment won the race', async () => {
    const { service, releaseHoldForOrder } = makeService(false);
    await expect(service.cancelOrder(5, 9)).rejects.toThrow();
    expect(releaseHoldForOrder).not.toHaveBeenCalled();
  });

  it('should release the eXU hold but not lower the coupon count', async () => {
    const { service, releaseHoldForOrder, releaseCoupon } = makeService(true);
    await service.cancelOrder(5, 9);
    expect(releaseHoldForOrder).toHaveBeenCalledWith(5);
    expect(releaseCoupon).not.toHaveBeenCalled();
  });
});

describe('coupon limits count pending orders (security 12/11/2026)', () => {
  function makeCoupons(
    coupon: Record<string, unknown>,
    counts: { pending: number; mine: number },
  ) {
    const service = Object.create(CouponsService.prototype) as CouponsService;
    const count = jest.fn(({ where }: { where: { status: unknown } }) =>
      Promise.resolve(
        where.status === 'pending' ? counts.pending : counts.mine,
      ),
    );
    Object.assign(service as unknown as Record<string, unknown>, {
      couponRepository: {
        findByCode: jest.fn().mockResolvedValue({
          code: 'HELLO',
          isActive: true,
          suspendedAt: null,
          expiresAt: null,
          maxUsage: null,
          maxUsagePerUser: null,
          minOrderAmount: null,
          usageCount: 0,
          discountPercent: 10,
          discountType: 'percent',
          ...coupon,
        }),
      },
      orderRepo: { count },
    });
    return { service, count };
  }

  it('should refuse a code whose last use is taken by a pending order', async () => {
    const { service } = makeCoupons(
      { maxUsage: 10, usageCount: 9 },
      { pending: 1, mine: 0 },
    );
    await expect(
      service.validateCoupon({ code: 'HELLO', orderAmount: 100 } as never, 1),
    ).rejects.toThrow('Coupon usage limit reached');
  });

  it('should count my pending orders against the per-user limit', async () => {
    const { service, count } = makeCoupons(
      { maxUsagePerUser: 1 },
      { pending: 0, mine: 1 },
    );
    await expect(
      service.validateCoupon({ code: 'HELLO', orderAmount: 100 } as never, 1),
    ).rejects.toThrow('maximum usage');
    expect(count).toHaveBeenCalledWith({
      where: {
        userId: 1,
        couponCode: 'HELLO',
        status: In(['paid', 'pending']),
      },
    });
  });
});
