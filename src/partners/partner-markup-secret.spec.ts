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
      dataSource: {
        query: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: 'Nhật 5GB',
            slug: 'jp-5gb',
            durationDays: 7,
            dataMb: 5120,
            vndPrice: 200000,
            vndCostPrice: 100000,
          },
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
});
