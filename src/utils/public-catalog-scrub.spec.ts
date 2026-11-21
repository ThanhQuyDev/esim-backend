import { JwtService } from '@nestjs/jwt';
import { lastValueFrom, of } from 'rxjs';
import {
  PublicCatalogScrubInterceptor,
  scrubBusinessData,
} from './public-catalog-scrub';
import { multidayRetailVnd } from '../plans/multiday-price';

/**
 * vande-2011 #041 — "lộ bí mật kinh doanh": cost, supplier and sales figures
 * were in every public plan response and in the HTML built from it.
 */
describe('Dữ liệu kinh doanh không ra ngoài (vande-2011 #041)', () => {
  const TIERS = [
    { minVnd: 0, maxVnd: 99999, percentage: 0, fixedAmountVnd: 50000 },
    { minVnd: 100000, maxVnd: 1e9, percentage: 70, fixedAmountVnd: 0 },
  ];
  const plan = (over: Record<string, unknown> = {}) => ({
    id: 1,
    provider: 'esimaccess',
    providerPlanId: 'CKH484',
    name: 'Europe 1GB 7Days',
    price: '5.72',
    retailPrice: '5.22',
    usdRetailPrice: 5.22,
    vndRetailPrice: 134000,
    costPrice: '2.61',
    usdCostPrice: 2.61,
    vndCostPrice: 67000,
    vndCostExact: 67154.57,
    vndPrice: 147000,
    supplierActiveType: 2,
    supplierActivationPolicy: 'First Network Connection',
    soldCount: 59,
    apn: 'drei.at',
    ipExport: 'UK/NO',
    lastSyncedAt: '2026-11-20T12:03:16.644Z',
    refundableOverride: null,
    isAbleMultidate: false,
    isLocalInventory: false,
    isDomesticEsim: false,
    isRefundable: true,
    region: {
      id: 12,
      slug: 'esim-chau-au',
      externalCode: 'esimaccess-eu-42',
      providers: 'esimaccess',
      soldCount: 0,
    },
    ...over,
  });

  it('should drop cost, supplier and sales fields from a plan and its region', () => {
    const out = scrubBusinessData({ dataPlans: [plan()] }, TIERS) as {
      dataPlans: Record<string, unknown>[];
    };
    const p = out.dataPlans[0];
    const json = JSON.stringify(out);
    for (const word of [
      'costPrice',
      'vndCost',
      'usdCost',
      'providerPlanId',
      'CKH484',
      'esimaccess',
      'soldCount',
      'supplierActive',
      'drei.at',
      'lastSyncedAt',
      'externalCode',
      'RetailPrice',
    ]) {
      expect(json).not.toContain(word);
    }
    expect(p.provider).toBeNull();
    // What the page shows stays.
    expect(p).toMatchObject({
      id: 1,
      price: '5.72',
      vndPrice: 147000,
      isRefundable: true,
    });
    // Supplier retail below our price is not given away.
    expect(p.retailPrice).toBe('5.72');
  });

  it('should keep a struck-out price that is really higher', () => {
    const out = scrubBusinessData(
      plan({ retailPrice: '9.00' }),
      TIERS,
    ) as Record<string, unknown>;
    expect(out.retailPrice).toBe('9.00');
  });

  it("should keep a domestic carrier's name and package code", () => {
    const out = scrubBusinessData(
      plan({
        provider: 'viettel',
        providerPlanId: '5G150N',
        isLocalInventory: true,
      }),
      TIERS,
    ) as Record<string, unknown>;
    expect(out.provider).toBe('viettel');
    expect(out.providerPlanId).toBe('5G150N');
    expect(out.costPrice).toBeUndefined();
  });

  it('should give a day pass its prices for 1–365 days, the same as checkout', () => {
    const p = plan({
      isAbleMultidate: true,
      vndPrice: 30000,
      vndCostExact: 12345,
      vndCostPrice: 12000,
    });
    const out = scrubBusinessData(p, TIERS) as { multidayK: number[] };
    expect(out.multidayK).toHaveLength(365);
    for (const d of [1, 2, 7, 30, 365]) {
      expect(out.multidayK[d - 1] * 1000).toBe(multidayRetailVnd(p, d, TIERS));
    }
  });

  it('should not change what it was given', () => {
    const p = plan();
    scrubBusinessData([p], TIERS);
    expect(p.costPrice).toBe('2.61');
    expect(p.region.providers).toBe('esimaccess');
  });

  describe('interceptor', () => {
    const SECRET = 's3cret';
    const jwt = new JwtService();
    const ctx = (authorization?: string) =>
      ({
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization } }),
        }),
      }) as never;
    const run = (authorization?: string) =>
      lastValueFrom(
        new PublicCatalogScrubInterceptor(SECRET, () =>
          Promise.resolve(TIERS),
        ).intercept(ctx(authorization), {
          handle: () => of({ dataPlans: [plan()] }),
        }),
      ) as Promise<{ dataPlans: Record<string, unknown>[] }>;

    it('should scrub for a visitor, a customer and a partner', async () => {
      expect((await run()).dataPlans[0].costPrice).toBeUndefined();
      for (const role of [2, 3, 4]) {
        const t = jwt.sign({ id: 9, role: { id: role } }, { secret: SECRET });
        expect(
          (await run(`Bearer ${t}`)).dataPlans[0].costPrice,
        ).toBeUndefined();
      }
    });

    it('should leave everything for an admin, and nothing for a forged admin token', async () => {
      const admin = jwt.sign({ id: 1, role: { id: 1 } }, { secret: SECRET });
      expect((await run(`Bearer ${admin}`)).dataPlans[0].costPrice).toBe(
        '2.61',
      );
      const forged = jwt.sign({ id: 1, role: { id: 1 } }, { secret: 'other' });
      expect(
        (await run(`Bearer ${forged}`)).dataPlans[0].costPrice,
      ).toBeUndefined();
    });
  });

  describe("a customer's own eSIMs and topups (vande-2011 #042)", () => {
    const esim = {
      id: 7,
      iccid: '8988',
      provider: 'billion',
      canTopUp: true,
      topups: [{ topupProvider: 'BILLION', providerPackageId: 'SKU-1' }],
      plan: { ...plan(), provider: 'billion' },
    };

    it('should not name an international supplier to a customer', () => {
      const out = scrubBusinessData({ data: [esim] }, TIERS, 0, {
        hideSupplier: true,
      });
      const json = JSON.stringify(out);
      expect(json).not.toMatch(/billion|SKU-1/i);
      expect(json).toContain('"canTopUp":true');
    });

    it("should keep a domestic carrier's name for a customer", () => {
      const out = scrubBusinessData(
        { provider: 'viettel-noidia', topupProvider: 'viettel' },
        TIERS,
        0,
        { hideSupplier: true },
      );
      expect(out).toEqual({
        provider: 'viettel-noidia',
        topupProvider: 'viettel',
      });
    });

    it('should still name the supplier to a partner', async () => {
      const SECRET = 'k';
      const jwt = new JwtService();
      const run = (role: number) =>
        lastValueFrom(
          new PublicCatalogScrubInterceptor(SECRET, () =>
            Promise.resolve(TIERS),
          ).intercept(
            {
              getType: () => 'http',
              switchToHttp: () => ({
                getRequest: () => ({
                  headers: {
                    authorization: `Bearer ${jwt.sign({ id: 3, role: { id: role } }, { secret: SECRET })}`,
                  },
                }),
              }),
            } as never,
            { handle: () => of({ provider: 'esimaccess' }) },
          ),
        ) as Promise<{ provider: string | null }>;
      expect((await run(4)).provider).toBe('esimaccess');
      expect((await run(2)).provider).toBeNull();
    });
  });

  it("should swap a supplier's flag for the storefront's own", () => {
    const out = scrubBusinessData(
      {
        destination: {
          countryCode: 'cn',
          flagUrl: 'https://cdn-revamp.airalo.com/images/301616a0.png',
          avatarUrl: 'https://cdn-revamp.airalo.com/images/x.png',
          iconUrl: 'https://res.cloudinary.com/deqfcfcwf/image/upload/a.png',
        },
      },
      TIERS,
    ) as { destination: Record<string, unknown> };
    expect(out.destination).toMatchObject({
      flagUrl: '/flags/CN.svg',
      avatarUrl: null,
      iconUrl: 'https://res.cloudinary.com/deqfcfcwf/image/upload/a.png',
    });
  });
});
