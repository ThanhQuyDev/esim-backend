import { BillionService, isBillionRechargeProduct } from './billion.service';

/**
 * Billion has two kinds of product (doitac-1410 #064): an eSIM ("…+eSIM
 * Carrier of 90 days", types 230/3105/3106) sold to customers, and a
 * recharge product ("China Mainland(Multi)-3GB/Natural day") that only adds
 * data to an eSIM F052 says may take it. A topup offers the latter, and only
 * those F052 names for the ICCID. Billion's API is mocked throughout.
 */

const ESIM = {
  skuId: '900',
  name: 'China Mainland(Multi)-3GB/Natural day+eSIM Carrier of 90 days',
  type: '3105',
  days: '1',
  highFlowSize: String(3 * 1024 * 1024),
  planType: '1',
};
const RECHARGE = {
  skuId: '501',
  name: 'China Mainland(Multi)-3GB/Natural day',
  type: '110',
  days: '7',
  highFlowSize: String(3 * 1024 * 1024),
  planType: '1',
};
const OTHER_RECHARGE = {
  skuId: '502',
  name: 'Japan-1GB/day',
  type: '110',
  days: '3',
  highFlowSize: String(1024 * 1024),
  planType: '1',
};

function buildService(rechargeSkus: string[]) {
  const invoke = jest.fn().mockImplementation((tradeType: string) => {
    if (tradeType === 'F052') return Promise.resolve({ skuId: rechargeSkus });
    if (tradeType === 'F002') {
      return Promise.resolve([ESIM, RECHARGE, OTHER_RECHARGE]);
    }
    if (tradeType === 'F003') {
      return Promise.resolve([
        { skuId: '900', price: [{ copies: '1', settlementPrice: '4' }] },
        { skuId: '501', price: [{ copies: '1', settlementPrice: '78' }] },
        { skuId: '502', price: [{ copies: '1', settlementPrice: '20' }] },
      ]);
    }
    return Promise.reject(new Error(`unexpected ${tradeType}`));
  });
  const service = Object.create(BillionService.prototype) as BillionService;
  Object.assign(service, {
    invoke,
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
    exchangeRateService: {
      getHkdToUsdRate: jest.fn().mockResolvedValue(0.128),
    },
    rechargeCatalogue: null,
  });
  return { service, invoke };
}

describe('isBillionRechargeProduct (doitac-1410 #064)', () => {
  it('should tell a recharge product from an eSIM', () => {
    expect(isBillionRechargeProduct(RECHARGE)).toBe(true);
    expect(isBillionRechargeProduct(ESIM)).toBe(false);
    // An unknown type with "eSIM" in the name is still an eSIM.
    expect(
      isBillionRechargeProduct({ type: '999', name: 'Korea 1GB+eSIM' }),
    ).toBe(false);
  });
});

describe('BillionService.listTopupOffers (doitac-1410 #064)', () => {
  it('should offer only the recharge products F052 names for this eSIM', async () => {
    const { service, invoke } = buildService(['501']);

    const offers = await service.listTopupOffers('8985200000000000001');

    expect(invoke).toHaveBeenCalledWith('F052', {
      iccid: '8985200000000000001',
    });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      providerPlanId: '501',
      name: 'China Mainland(Multi)-3GB/Natural day',
      durationDays: 7,
      dataMb: 3072,
    });
    // 78 HKD at 0.128 USD.
    expect(offers[0].costUsd).toBeCloseTo(9.984, 3);
  });

  it('should offer nothing for an eSIM that takes no topup', async () => {
    const { service, invoke } = buildService([]);

    await expect(service.listTopupOffers('8985')).resolves.toEqual([]);
    // No catalogue fetch when there is nothing to price.
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('should never offer an eSIM product as a topup, even if F052 names it', async () => {
    const { service } = buildService(['900', '502']);

    const offers = await service.listTopupOffers('8985');

    expect(offers.map((o) => o.providerPlanId)).toEqual(['502']);
  });

  it('should fetch the recharge catalogue once for several eSIMs', async () => {
    const { service, invoke } = buildService(['501']);

    await service.listTopupOffers('a');
    await service.listTopupOffers('b');

    const catalogueCalls = invoke.mock.calls.filter(([t]) => t === 'F002');
    expect(catalogueCalls).toHaveLength(1);
  });
});
