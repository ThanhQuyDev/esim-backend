import { PartnersService } from './partners.service';
import { partnerSuggestedRetailVnd } from './partner-purchase';

/**
 * doitac-3010 #026 — what the partner price list shows per plan: the
 * standard name, a region with its countries, "Không rõ" for TikTok & AI when
 * nobody knows, eKYC / hotspot / roaming, and an order dialog whose revenue is
 * the suggested retail price the list shows.
 */
function service(plan: Record<string, unknown>) {
  const s = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(s, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 4,
      partnerType: 'distribution',
      status: 'active',
      tierCode: 'GOLD',
    }),
    purchaseMarkupPercentFor: jest.fn().mockResolvedValue(8),
    plansService: {
      findManyWithPagination: jest.fn().mockResolvedValue([[plan], 1]),
    },
    dataSource: {
      query: jest
        .fn()
        .mockResolvedValue([{ vndPrice: 200000, vndCostPrice: 100000 }]),
    },
    getOrCreateWallet: jest
      .fn()
      .mockResolvedValue({ status: 'active', balanceVnd: '5000000' }),
  });
  return s;
}

const BASE = {
  id: 1,
  name: 'Asia 20 countries 5GB 7days',
  slug: 'asia-5gb',
  durationDays: 7,
  dataMb: 5120,
  vndPrice: 200000,
  vndCostPrice: 100000,
};

describe('Partner price list columns (doitac-3010 #026)', () => {
  it('should show the standard name, keeping the supplier name aside', async () => {
    const [plan] = (
      await service({
        ...BASE,
        standardName: 'Asia - Total 5 GB - 7 days',
      }).getPurchaseCatalogue(4)
    ).plans;
    expect(plan.name).toBe('Asia - Total 5 GB - 7 days');
    expect(plan.supplierName).toBe('Asia 20 countries 5GB 7days');
  });

  it("should list a region's countries with their flags", async () => {
    const [plan] = (
      await service({
        ...BASE,
        region: {
          name: 'Asia',
          titleVi: 'Châu Á',
          destinations: [
            { name: 'Japan', titleVi: 'Nhật Bản', flagUrl: '/jp.png' },
            { name: 'Korea', titleVi: null, flagUrl: null },
          ],
        },
      }).getPurchaseCatalogue(4)
    ).plans;
    expect(plan.region).toEqual({
      name: 'Châu Á',
      avatarUrl: null,
      countries: [
        { name: 'Nhật Bản', flagUrl: '/jp.png' },
        { name: 'Korea', flagUrl: null },
      ],
    });
  });

  it('should say nobody knows about TikTok & AI rather than "no"', async () => {
    const unknown = (await service(BASE).getPurchaseCatalogue(4)).plans[0];
    expect(unknown).toMatchObject({ tiktokAi: false, tiktokAiKnown: false });

    const known = (
      await service({
        ...BASE,
        appSupport: { known: true, tiktokAllDevices: true, chatGpt: true },
      }).getPurchaseCatalogue(4)
    ).plans[0];
    expect(known).toMatchObject({ tiktokAi: true, tiktokAiKnown: true });
  });

  it('should carry eKYC and hotspot', async () => {
    const [plan] = (
      await service({
        ...BASE,
        isKyc: true,
        hotSpot: true,
        hotSpotAllow: '1',
      }).getPurchaseCatalogue(4)
    ).plans;
    expect(plan).toMatchObject({
      isKyc: true,
      hotSpot: true,
      hotSpotAllow: '1',
    });
  });

  it("should price the order's revenue at the suggested retail price", async () => {
    const quote = await service(BASE).quotePurchase(4, 1, 3);
    const unit = partnerSuggestedRetailVnd(quote.unitPriceVnd);
    expect(quote.suggestedRetailUnitVnd).toBe(unit);
    expect(quote.suggestedRetailTotalVnd).toBe(unit * 3);
    expect(quote.suggestedMarginVnd).toBe(unit * 3 - quote.totalVnd);
  });
});
