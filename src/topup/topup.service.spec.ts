import { TopupService } from './topup.service';
import { TopupProvider } from './dto/topup-package.dto';
import { OrderType, TOPUP_ORDER_STATUS } from './topup.constants';

/**
 * Regression tests for the topup package identity.
 *
 * A DB-catalogued provider's `providerPlanId` is NOT unique across our `plan`
 * rows (a bad gadgetkorea import once gave 1786 plans the same value). When the
 * DTO's `packageId` was that value, picking any package charged for whichever
 * row matched first â€” a customer selecting a 599.000Ä‘ package was billed
 * 1.649.000Ä‘. `packageId` is therefore `plan.id`, and the provider-side id is
 * resolved from the plan only at submit time.
 */

const PLANS = [
  {
    id: 83830,
    name: 'Australia 3GB per day',
    providerPlanId: 'SHARED-BAD-ID',
    type: 'daily',
    dataMb: 3072,
    durationDays: 10,
    costPrice: '23.0100',
    price: '30.0000',
    retailPrice: '0.00',
    vndPrice: '599000',
    destinationId: 245,
  },
  {
    id: 83833,
    name: 'Australia 3GB per day',
    providerPlanId: 'SHARED-BAD-ID',
    type: 'daily',
    dataMb: 3072,
    durationDays: 30,
    costPrice: '48.7300',
    price: '70.0000',
    retailPrice: '63.35',
    vndPrice: '1649000',
    destinationId: 245,
  },
];

function buildService(overrides: Record<string, unknown> = {}) {
  const deps = {
    orderRepository: {},
    esimsService: {
      findByIccid: jest.fn().mockResolvedValue({
        id: 1,
        provider: 'gadgetkorea',
        planId: 83830,
        esimTranNo: 'GK-TOPUP-1',
      }),
    },
    plansService: {
      findById: jest
        .fn()
        .mockImplementation((id: number) =>
          Promise.resolve(PLANS.find((p) => p.id === Number(id)) ?? null),
        ),
      findManyWithPagination: jest
        .fn()
        .mockResolvedValue([PLANS, PLANS.length]),
    },
    airaloService: {},
    esimAccessService: {},
    gadgetKoreaService: { submitTopup: jest.fn().mockResolvedValue(undefined) },
    billionService: {},
    microEsimService: {},
    onepayService: {},
    profitMarginsService: {},
    configService: {},
    ...overrides,
  };

  const service = new TopupService(
    deps.orderRepository as never,
    deps.esimsService as never,
    deps.plansService as never,
    deps.airaloService as never,
    deps.esimAccessService as never,
    deps.gadgetKoreaService as never,
    deps.billionService as never,
    deps.microEsimService as never,
    deps.onepayService as never,
    deps.profitMarginsService as never,
    // #028 — WalletsService and InvoicesService.
    {} as never,
    {} as never,
    deps.configService as never,
  );
  return { service, deps };
}

describe('TopupService â€” DB-catalogued package identity', () => {
  it('should give every package a distinct packageId even when providerPlanId collides', async () => {
    const { service } = buildService();

    const { packages, provider } = await service.listPackages(
      '8982000000000000001',
    );

    expect(provider).toBe(TopupProvider.GADGET_KOREA);
    expect(packages.map((p) => p.packageId)).toEqual(['83830', '83833']);
    expect(new Set(packages.map((p) => p.packageId)).size).toBe(
      packages.length,
    );
    // The colliding provider id is still exposed, just not used as identity.
    expect(packages.every((p) => p.providerPackageId === 'SHARED-BAD-ID')).toBe(
      true,
    );
  });

  it('should sell at our margin price, not the provider catalogue price (#086)', async () => {
    const { service } = buildService();

    const { packages } = await service.listPackages('8982000000000000001');

    expect(packages[0].vndPrice).toBe(599000);
    expect(packages[0].price).toBe(23.01);
    // retailPrice '0.00' must not win over price just by being a truthy string.
    expect(packages[0].retailPrice).toBe(30);
    // The second plan cost us 48.73 and our tiers price it at 70, while the
    // provider catalogue still says 63.35. Preferring their number sold the
    // topup below our own margin â€” `price` is the column the tier job keeps
    // up to date, `retailPrice` is never recalculated.
    expect(packages[1].retailPrice).toBe(70);
  });

  it('should submit the provider id resolved from the ordered plan, not the plan id', async () => {
    const order = {
      id: 7,
      orderNumber: 'TOPUP-1-ABC',
      orderType: OrderType.TOPUP,
      status: TOPUP_ORDER_STATUS.PAID,
      topupProvider: TopupProvider.GADGET_KOREA,
      topupPackageId: '83830',
      targetIccid: '8982000000000000001',
    };
    const orderRepository = {
      findByOrderNumber: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const { service, deps } = buildService({ orderRepository });

    await service.executeTopup('TOPUP-1-ABC');

    expect(deps.gadgetKoreaService['submitTopup']).toHaveBeenCalledWith({
      topupId: 'GK-TOPUP-1',
      optionId: 'SHARED-BAD-ID',
    });
    expect(orderRepository.update).toHaveBeenCalledWith(7, {
      status: TOPUP_ORDER_STATUS.COMPLETED,
    });
  });
});

describe('TopupService — Billion recharge products (doitac-1410 #064)', () => {
  const OFFER = {
    providerPlanId: '501:7',
    copies: 7,
    durationDays: 7,
    cost: 78,
    costUsd: 9.98,
    type: 'daily',
    dataMb: 3072,
    fupSpeed: null,
    name: 'China Mainland(Multi)-3GB/Natural day - 7 days',
  };
  const billionEsim = {
    findByIccid: jest.fn().mockResolvedValue({
      id: 2,
      provider: 'billion',
      planId: 900,
    }),
  };

  it('should list only what this eSIM may recharge with, at our margin', async () => {
    const billionService = {
      listTopupOffers: jest.fn().mockResolvedValue([OFFER]),
    };
    const { service, deps } = buildService({
      esimsService: billionEsim,
      billionService,
      profitMarginsService: {
        calculateRetailVndFromCostUsd: jest.fn().mockResolvedValue(349000),
      },
      configService: { get: jest.fn() },
    });
    jest
      .spyOn(service as never, 'fetchVndRate' as never)
      .mockResolvedValue(25000 as never);

    const { provider, packages } = await service.listPackages('8985');

    expect(provider).toBe(TopupProvider.BILLION);
    expect(billionService.listTopupOffers).toHaveBeenCalledWith('8985');
    // Never the eSIM products of our plan table.
    expect(deps.plansService.findManyWithPagination).not.toHaveBeenCalled();
    expect(packages).toEqual([
      expect.objectContaining({
        packageId: 'billion:501:7',
        providerPackageId: '501:7',
        durationDays: 7,
        price: 9.98,
        vndPrice: 349000,
      }),
    ]);
  });

  it('should list nothing for an eSIM Billion gives no recharge product', async () => {
    const { service } = buildService({
      esimsService: billionEsim,
      billionService: { listTopupOffers: jest.fn().mockResolvedValue([]) },
    });
    jest
      .spyOn(service as never, 'fetchVndRate' as never)
      .mockResolvedValue(25000 as never);

    const { packages } = await service.listPackages('8985');

    expect(packages).toEqual([]);
  });

  it('should recharge with the skuId and copies of the chosen product', async () => {
    const order = {
      id: 8,
      orderNumber: 'TOPUP-2-XYZ',
      orderType: OrderType.TOPUP,
      status: TOPUP_ORDER_STATUS.PAID,
      topupProvider: TopupProvider.BILLION,
      topupPackageId: 'billion:501:7',
      targetIccid: '8985',
    };
    const orderRepository = {
      findByOrderNumber: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const billionService = {
      submitTopup: jest.fn().mockResolvedValue(undefined),
    };
    const { service, deps } = buildService({
      orderRepository,
      esimsService: billionEsim,
      billionService,
    });

    await service.executeTopup('TOPUP-2-XYZ');

    expect(billionService.submitTopup).toHaveBeenCalledWith(
      expect.objectContaining({ iccid: '8985', skuId: '501', copies: 7 }),
    );
    // A numeric-looking sku is never read as one of our plan ids.
    expect(deps.plansService.findById).not.toHaveBeenCalled();
  });
});
