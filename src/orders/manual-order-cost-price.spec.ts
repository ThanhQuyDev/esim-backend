import { OrdersService } from './orders.service';
import { FALLBACK_USD_VND_RATE } from '../plans/exchange-rate.service';

/**
 * #042 — an đặt đơn hộ order showed no giá vốn on its detail page and added
 * nothing to the cost side of the overview, so it looked like pure profit.
 *
 * The cause was upstream of the display: `submitManualOrder` called
 * `createPendingOrder` with no USD→VND rate, and without a rate that method
 * stores `vndCostPrice = 0` for every non-local plan. These tests pin the rate
 * being passed, because nothing else about the order reveals that it is missing.
 */
describe('Cost price on a manual order (#042)', () => {
  const PLAN = {
    id: 3,
    slug: 'ID_1_7',
    providerPlanId: 'JC056',
    currency: 'USD',
    costPrice: 4,
    usdPrice: 6,
    isActive: true,
  };

  function makeService(rate: number | Error = 25000) {
    const getUsdToVndRate = jest.fn(() =>
      rate instanceof Error ? Promise.reject(rate) : Promise.resolve(rate),
    );

    const service = Object.create(OrdersService.prototype) as OrdersService;
    const internals = service as unknown as Record<string, unknown>;

    internals.usersService = {
      findByEmail: jest.fn().mockResolvedValue({ id: 42 }),
      create: jest.fn(),
    };
    internals.plansService = { findBySlug: jest.fn().mockResolvedValue(PLAN) };
    internals.exchangeRateService = { getUsdToVndRate };
    internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    internals.createPendingOrder = jest
      .fn()
      .mockResolvedValue({ id: 11, orderNumber: 'MAN-1' });
    internals.finalizePaidOrder = jest.fn().mockResolvedValue(undefined);
    internals.submitProviders = jest.fn().mockResolvedValue(undefined);
    internals.orderRepository = {
      findById: jest.fn().mockResolvedValue({ id: 11 }),
    };

    return { service, internals, getUsdToVndRate };
  }

  const DTO = {
    email: 'khach@example.com',
    packageCode: 'JC056',
    slug: 'ID_1_7',
    quantity: 2,
  };

  it('should passes a real USD→VND rate to createPendingOrder', async () => {
    const { service, internals } = makeService(25000);

    await service.submitManualOrder(5, DTO);

    const [, , , vndRate] = (internals.createPendingOrder as jest.Mock).mock
      .calls[0];
    expect(vndRate).toBe(25000);
  });

  it('should never passes 0 or 1 as the rate', async () => {
    // Either would store a cost of 0 (falsy) or a cost in dollars labelled as
    // đồng — both of which read as "this order cost us nothing".
    const { service, internals } = makeService();

    await service.submitManualOrder(5, DTO);

    const [, , , vndRate] = (internals.createPendingOrder as jest.Mock).mock
      .calls[0];
    expect(vndRate).toBeGreaterThan(1000);
  });

  it('should asks for the rate once per order', async () => {
    const { service, getUsdToVndRate } = makeService();

    await service.submitManualOrder(5, DTO);

    expect(getUsdToVndRate).toHaveBeenCalledTimes(1);
  });

  it('should be built on a rate source that cannot fail the order', () => {
    // `getUsdToVndRate` never throws — it falls back to the last known rate and
    // then to a constant. If that ever changes, an FX outage would start
    // blocking đặt đơn hộ entirely, so this records the dependency.
    expect(FALLBACK_USD_VND_RATE).toBeGreaterThan(1000);
  });
});
