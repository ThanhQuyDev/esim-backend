import { OrdersService } from './orders.service';
import { PlansService } from '../plans/plans.service';

/** vande-0411 #010 — a bulk order names a plan by slug or supplier code. */
const DAY_PASS = {
  id: 1,
  slug: 'cn-1gb',
  providerPlanId: 'PVG1G9ZU2',
  isActive: true,
  isAbleMultidate: true,
};
const FIXED = {
  id: 2,
  slug: 'jp-5gb',
  providerPlanId: 'JP5',
  isActive: true,
  isAbleMultidate: false,
};

function planLookup(plans: unknown[]) {
  const service = Object.create(PlansService.prototype) as PlansService;
  const list = plans as { slug: string; providerPlanId: string }[];
  Object.assign(service, {
    plansRepository: {
      findBySlug: jest.fn((slug: string) =>
        Promise.resolve(list.find((p) => p.slug === slug) ?? null),
      ),
      findAllByProviderPlanId: jest.fn((code: string) =>
        Promise.resolve(list.filter((p) => p.providerPlanId === code)),
      ),
    },
  });
  return service;
}

describe('Mã gói trong file đặt hàng loạt (vande-0411 #010)', () => {
  it('should find a plan by slug or by supplier code', async () => {
    const plans = planLookup([DAY_PASS, FIXED]);
    expect((await plans.findByOrderCode('cn-1gb')).plan).toBe(DAY_PASS);
    expect((await plans.findByOrderCode('PVG1G9ZU2')).plan).toBe(DAY_PASS);
    expect((await plans.findByOrderCode('nope')).plan).toBeNull();
  });

  it('should not guess when two suppliers share a code', async () => {
    const plans = planLookup([
      DAY_PASS,
      { ...FIXED, providerPlanId: 'PVG1G9ZU2' },
    ]);
    expect(await plans.findByOrderCode('PVG1G9ZU2')).toEqual({
      plan: null,
      ambiguous: true,
    });
  });

  it('should send the days of a day pass, and none for a fixed plan', async () => {
    const service = Object.create(OrdersService.prototype) as OrdersService;
    const submitManualOrder = jest
      .fn()
      .mockResolvedValue({ id: 5, orderNumber: 'MAN-1' });
    Object.assign(service, {
      submitManualOrder,
      resendEsimEmail: jest.fn().mockResolvedValue({ sent: 1 }),
      plansService: planLookup([DAY_PASS, FIXED]),
      usersService: {
        findById: jest.fn().mockResolvedValue({ email: 'admin@esim.vn' }),
      },
      logger: { error: jest.fn(), log: jest.fn() },
    });

    await service.submitBulkOrders(1, {
      mode: 'file',
      rows: [
        { slug: 'PVG1G9ZU2', quantity: 2, days: 14 },
        { slug: 'JP5', quantity: 1, days: 14 },
      ],
    });

    const items = submitManualOrder.mock.calls[0][1].items;
    expect(items[0]).toMatchObject({ slug: 'cn-1gb', periodNum: 14 });
    expect(items[1].periodNum).toBeUndefined();
  });
});
