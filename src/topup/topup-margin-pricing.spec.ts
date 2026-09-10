import { TopupService } from './topup.service';
import { TopupProvider } from './dto/topup-package.dto';
import { FALLBACK_USD_VND_RATE } from './topup.constants';

/**
 * Margin pricing on topup packages (#086).
 *
 * Topups are sold from three places — Airalo's API, eSIM Access's API, and our
 * own `plan` table for the providers with no topup API. Each one had a path
 * that quietly bypassed the profit tiers:
 *
 *   • the provider APIs fell back to the PROVIDER's retail price whenever the
 *     FX rate lookup failed, i.e. a price carrying their margin and none of
 *     ours;
 *   • the DB catalogue preferred `plan.retailPrice`, a column the tier
 *     recalculation never touches, over `plan.price`, which it maintains.
 *
 * A topup must never be offered at a price the margin tiers did not produce.
 */

/** Tiers: +100% on anything up to 2M VND. */
function marginService() {
  return {
    calculateRetailVndFromCostUsd: jest
      .fn()
      .mockImplementation((costUsd: number, rate: number) =>
        Promise.resolve(Math.round((costUsd * rate * 2) / 1000) * 1000),
      ),
  };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const deps = {
    orderRepository: {},
    esimsService: {},
    plansService: {},
    airaloService: {},
    esimAccessService: {},
    gadgetKoreaService: {},
    billionService: {},
    microEsimService: {},
    onepayService: {},
    profitMarginsService: marginService(),
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
    deps.configService as never,
  );
  return { service, deps };
}

/** `mapAiraloPackage` / `mapEsimAccessPackage` are private but are the rule. */
function callPrivate<T>(
  service: TopupService,
  name: string,
  ...args: unknown[]
) {
  return (
    service as unknown as Record<string, (...a: unknown[]) => Promise<T>>
  )[name](...args);
}

const AIRALO_PACKAGE = {
  id: 'airalo-1',
  title: 'Japan 3GB',
  amount: 3072,
  day: 15,
  is_unlimited: false,
  /** Our cost. */
  net_price: 10,
  /** Airalo's own retail — never ours to resell. */
  price: 14,
};

const ESIM_ACCESS_PACKAGE = {
  packageCode: 'ea-1',
  name: 'Korea 5GB',
  volume: 5 * 1024 * 1024 * 1024,
  dataType: 1,
  duration: 30,
  /** Cost, in provider units (÷10000). */
  price: 120_000,
  /** Their retail, same units. */
  retailPrice: 160_000,
};

describe('TopupService — margin pricing', () => {
  it('should apply our tiers to an Airalo package', async () => {
    const { service, deps } = buildService();

    const dto = await callPrivate<{ vndPrice?: number; retailPrice: number }>(
      service,
      'mapAiraloPackage',
      AIRALO_PACKAGE,
      25_000,
    );

    // 10 USD cost × 25.000 × 2 = 500.000đ, not Airalo's 14 USD retail.
    expect(
      deps.profitMarginsService.calculateRetailVndFromCostUsd,
    ).toHaveBeenCalledWith(10, 25_000);
    expect(dto.vndPrice).toBe(500_000);
    expect(dto.retailPrice).toBe(20);
  });

  it('should still apply our tiers when the FX rate is unavailable', async () => {
    const { service, deps } = buildService();

    const dto = await callPrivate<{ vndPrice?: number; retailPrice: number }>(
      service,
      'mapAiraloPackage',
      AIRALO_PACKAGE,
      null,
    );

    // The old code handed back Airalo's 14 USD retail here — no margin at all.
    expect(
      deps.profitMarginsService.calculateRetailVndFromCostUsd,
    ).toHaveBeenCalledWith(10, FALLBACK_USD_VND_RATE);
    expect(dto.vndPrice).toBe(10 * FALLBACK_USD_VND_RATE * 2);
    expect(dto.retailPrice).not.toBe(AIRALO_PACKAGE.price);
    expect(dto.retailPrice).toBeCloseTo(20, 2);
  });

  it('should apply our tiers to an eSIM Access package', async () => {
    const { service, deps } = buildService();

    const dto = await callPrivate<{ vndPrice?: number; retailPrice: number }>(
      service,
      'mapEsimAccessPackage',
      ESIM_ACCESS_PACKAGE,
      25_000,
    );

    // Cost is 120000/10000 = 12 USD.
    expect(
      deps.profitMarginsService.calculateRetailVndFromCostUsd,
    ).toHaveBeenCalledWith(12, 25_000);
    expect(dto.vndPrice).toBe(600_000);
  });

  it('should not fall back to the eSIM Access retail price without an FX rate', async () => {
    const { service } = buildService();

    const dto = await callPrivate<{ vndPrice?: number; retailPrice: number }>(
      service,
      'mapEsimAccessPackage',
      ESIM_ACCESS_PACKAGE,
      null,
    );

    // Their retail is 16 USD; ours is cost × 2 = 24 USD.
    expect(dto.retailPrice).not.toBe(16);
    expect(dto.vndPrice).toBe(12 * FALLBACK_USD_VND_RATE * 2);
  });

  it('should price a DB-catalogue package from our own price column', async () => {
    const plans = [
      {
        id: 5,
        name: 'Korea 10GB',
        providerPlanId: 'GK-10',
        type: 'fixed',
        dataMb: 10240,
        durationDays: 30,
        costPrice: '20.00',
        // What the tier job maintains.
        price: '40.00',
        // What the provider catalogue said, never recalculated.
        retailPrice: '31.00',
        vndPrice: null,
        isLocalInventory: false,
      },
    ];
    const { service } = buildService({
      plansService: {
        findManyWithPagination: jest
          .fn()
          .mockResolvedValue([plans, plans.length]),
      },
    });

    const packages = await callPrivate<
      { retailPrice: number; vndPrice?: number; price: number }[]
    >(
      service,
      'listDbCataloguePackages',
      'gadgetkorea',
      TopupProvider.GADGET_KOREA,
      null,
    );

    expect(packages[0].retailPrice).toBe(40);
    expect(packages[0].price).toBe(20);
    // No stored VND figure: derived from OUR price, never the provider's.
    expect(packages[0].vndPrice).toBe(
      Math.round((40 * FALLBACK_USD_VND_RATE) / 1000) * 1000,
    );
  });

  it('should keep the stored VND price when the plan already has one', async () => {
    const plans = [
      {
        id: 6,
        name: 'Vietnam 5GB',
        providerPlanId: 'VT-5',
        type: 'fixed',
        dataMb: 5120,
        durationDays: 30,
        costPrice: '150000',
        price: '199000',
        retailPrice: '0.00',
        vndPrice: '199000',
        isLocalInventory: true,
      },
    ];
    const { service } = buildService({
      plansService: {
        findManyWithPagination: jest
          .fn()
          .mockResolvedValue([plans, plans.length]),
      },
    });

    const packages = await callPrivate<{ vndPrice?: number }[]>(
      service,
      'listDbCataloguePackages',
      'viettel',
      TopupProvider.BILLION,
      null,
    );

    expect(packages[0].vndPrice).toBe(199_000);
  });
});
