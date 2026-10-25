import { PartnersService } from './partners.service';

/**
 * The % a tier adds to cost price is a trade secret and is never sent to a
 * partner (doitac-1410 #006) — only the price they pay.
 */
describe('cost markup is never sent to a partner (doitac-1410 #006)', () => {
  const tier = {
    tierCode: 'GOLD',
    tierName: 'Vàng',
    minVolumeVnd: 0,
    costMarkupPercent: 8,
  };

  function service() {
    const s = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(s, {
      getPartnerOrThrowById: jest.fn().mockResolvedValue({
        id: 4,
        partnerType: 'distribution',
        tierCode: 'GOLD',
      }),
      purchaseMarkupPercentFor: jest.fn().mockResolvedValue(8),
      tierRepository: {
        find: jest.fn().mockResolvedValue([{ ...tier }]),
        findOne: jest.fn().mockResolvedValue(null),
      },
      // The price list reads plans through the admin's filters (#033).
      plansService: {
        findManyWithPagination: jest.fn().mockResolvedValue([
          [
            {
              id: 1,
              name: 'Nhật 5GB',
              slug: 'jp-5gb',
              durationDays: 7,
              dataMb: 5120,
              vndPrice: 200000,
              vndCostPrice: 100000,
            },
          ],
          1,
        ]),
      },
    });
    return s;
  }

  it('should leave it out of the tier ladder', async () => {
    const tiers = await service().getMyTiers(4);

    expect(tiers[0]).not.toHaveProperty('costMarkupPercent');
    expect(tiers[0]).toMatchObject({ tierCode: 'GOLD' });
  });

  it('should leave it out of the price list, keeping the price itself', async () => {
    const catalogue = await service().getPurchaseCatalogue(4);

    expect(JSON.stringify(catalogue)).not.toMatch(/markup/i);
    expect(catalogue.plans[0].unitPriceVnd).toBe(108000);
  });

  it('should give both prices in dollars at the current rate (vande #055)', async () => {
    const s = service();
    Object.assign(s, {
      exchangeRateService: {
        getUsdToVndRate: jest.fn().mockResolvedValue(25000),
      },
    });

    const [plan] = (await s.getPurchaseCatalogue(4)).plans;

    expect(plan.unitPriceUsd).toBe(4.32);
    expect(plan.suggestedRetailUsd).toBe(
      Math.round((plan.suggestedRetailVnd / 25000) * 100) / 100,
    );
  });
});

describe('price list filters (doitac-1410 #033)', () => {
  function build() {
    const find = jest.fn().mockResolvedValue([[], 0]);
    const s = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(s, {
      getPartnerOrThrowById: jest.fn().mockResolvedValue({ id: 4 }),
      purchaseMarkupPercentFor: jest.fn().mockResolvedValue(8),
      plansService: { findManyWithPagination: find },
    });
    return { s, find };
  }

  it('should always ask for buyable, non-domestic plans', async () => {
    const { s, find } = build();
    await s.getPurchaseCatalogue(4);
    expect(find.mock.calls[0][0].filterOptions).toEqual({
      isActive: true,
      isDomesticEsim: false,
    });
  });

  it('should pass the admin filters through', async () => {
    const { s, find } = build();
    await s.getPurchaseCatalogue(4, {
      search: 'Nhật',
      location: 'r:3',
      duration: 7,
      data: '5GB',
      type: 'daily',
      topUp: true,
      hasCallSms: false,
      tiktokAi: true,
      isCheapest: true,
    });
    expect(find.mock.calls[0][0].filterOptions).toMatchObject({
      isActive: true,
      isDomesticEsim: false,
      search: 'Nhật',
      regionId: 3,
      duration: 7,
      data: '5GB',
      type: 'daily',
      topUp: true,
      hasCallSms: false,
      isNonHkIp: true,
      isCheapest: true,
    });
  });
});
