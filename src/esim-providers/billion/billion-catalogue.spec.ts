import { BillionPrice, BillionProduct } from './billion-api.types';
import {
  billionPlanVariants,
  billionRegionName,
  isRawBillionRegionName,
  parseBillionPlanId,
} from './billion-catalogue';

// Shapes copied from the live F002/F003 catalogue.
const product = (p: Partial<BillionProduct>): BillionProduct => ({
  skuId: '1000000000000001',
  name: 'x',
  type: '3106',
  ...p,
});

const price = (
  skuId: string,
  rows: Array<[copies: number, days: number, settlement: number]>,
): BillionPrice => ({
  skuId,
  price: rows.map(([copies, days, settlementPrice]) => ({
    copies: String(copies),
    days: String(days),
    settlementPrice: settlementPrice.toFixed(4),
    retailPrice: '0',
  })),
});

describe('billionPlanVariants', () => {
  it('should expand a self-selected daily sku into one plan per duration', () => {
    const korea = product({
      skuId: 'K1',
      type: '3105',
      planType: '1',
      days: '1',
      capacity: '-1',
      highFlowSize: '3145728',
      limitFlowSpeed: '128',
      name: 'Korea-3GB/Natural day+eSIM Carrier of 90 days  ',
    });
    const variants = billionPlanVariants(
      korea,
      price('K1', [
        [1, 1, 6],
        [2, 2, 10],
        [5, 5, 23],
      ]),
    );

    expect(
      variants.map((v) => [v.providerPlanId, v.durationDays, v.cost]),
    ).toEqual([
      ['K1', 1, 6],
      ['K1:2', 2, 10],
      ['K1:5', 5, 23],
    ]);
    expect(variants[1]).toMatchObject({
      type: 'daily',
      dataMb: 3072,
      fupSpeed: '128kbps',
      copies: 2,
      name: 'Korea-3GB/Natural day - 2 days',
    });
  });

  it('should keep the total quota of a self-selected total-type sku', () => {
    const japan = product({
      skuId: 'J1',
      type: '3105',
      planType: '0',
      days: '1',
      capacity: '-1',
      highFlowSize: '52428800',
      limitFlowSpeed: '384',
      name: 'Japan(Multi)-50GB,128kpbs-eSIM Carrier of 90 days ',
    });
    const variants = billionPlanVariants(
      japan,
      price('J1', [
        [3, 3, 99],
        [5, 5, 106],
      ]),
    );

    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({
      type: 'fixed',
      dataMb: 51200,
      durationDays: 3,
      cost: 99,
      providerPlanId: 'J1:3',
    });
  });

  it('should map a fixed-duration unlimited sku to one single-copy plan', () => {
    const skt = product({
      skuId: 'S1',
      type: '3106',
      planType: '1',
      days: '5',
      capacity: '-1',
      highFlowSize: '-1',
      limitFlowSpeed: '-1',
      name: 'South Korea(SKT)-5days-Unlimited Data-eSIM-SKTeSIM Carrier',
    });
    expect(billionPlanVariants(skt, price('S1', [[1, 5, 78]]))).toEqual([
      expect.objectContaining({
        providerPlanId: 'S1',
        copies: 1,
        durationDays: 5,
        cost: 78,
        type: 'unlimited',
        dataMb: 0,
      }),
    ]);
  });

  it('should map a fixed-duration total quota', () => {
    const maldives = product({
      skuId: 'M1',
      type: '3106',
      planType: '0',
      days: '10',
      capacity: '20971520',
      highFlowSize: '20971520',
      limitFlowSpeed: '0',
      name: 'Maldives(ooredoo)-10 Natural Days-20GB,0kbps+eSIM Carrier',
    });
    const [variant] = billionPlanVariants(
      maldives,
      price('M1', [[1, 10, 270]]),
    );
    expect(variant).toMatchObject({
      type: 'fixed',
      dataMb: 20480,
      durationDays: 10,
    });
  });

  it('should tell a speed-capped unlimited from a usable after-quota speed', () => {
    const capped = product({
      type: '3106',
      planType: '1',
      days: '1',
      highFlowSize: '0',
      limitFlowSpeed: '10240',
    });
    const reduced = product({
      type: '3106',
      planType: '1',
      days: '1',
      highFlowSize: '2097152',
      limitFlowSpeed: '1024',
    });
    const rows = price('x', [[1, 1, 1]]);

    expect(billionPlanVariants(capped, rows)[0]).toMatchObject({
      type: 'unlimited',
      fupSpeed: '10Mbps',
    });
    expect(billionPlanVariants(reduced, rows)[0]).toMatchObject({
      type: 'unlimited-reduce',
      dataMb: 2048,
    });
  });

  it('should yield nothing for a sku without a price', () => {
    expect(billionPlanVariants(product({ type: '3105' }), undefined)).toEqual(
      [],
    );
  });
});

describe('parseBillionPlanId', () => {
  it('should read the copies encoded in the plan id', () => {
    expect(parseBillionPlanId('1785911513572650:7')).toEqual({
      skuId: '1785911513572650',
      copies: 7,
    });
    expect(parseBillionPlanId('1785911513572650')).toEqual({
      skuId: '1785911513572650',
      copies: 1,
    });
  });
});

describe('billionRegionName', () => {
  it.each([
    [
      'Global 67 Destinations-Fixed 30GB-eSIM Carrier of 90 days ',
      'Global 67 Destinations',
    ],
    ['eSIM Carrier of 90 days +Hong Kong Macau-1GB/day', 'Hong Kong Macau'],
    ['Guam Saipan 2GB/Natural day+eSIM Carrier of 90 days', 'Guam Saipan'],
    ['Europe 33-daily 2GB-eSIM Carrier of 90 days', 'Europe 33'],
  ])('should name "%s" as "%s"', (name, expected) => {
    expect(billionRegionName(product({ name }))).toBe(expected);
  });

  it('should fall back to the country names', () => {
    const countries = [
      { mcc: 'MO', name: 'Macau (China)' },
      { mcc: 'HK', name: 'Hong Kong (China)' },
    ];
    const expected = 'Macau (China), Hong Kong (China)';

    expect(
      billionRegionName(product({ name: 'eSIM Carrier', country: countries })),
    ).toBe(expected);
    expect(
      billionRegionName(
        product({ name: 'Daily 1GB-eSIM Carrier', country: countries }),
      ),
    ).toBe(expected);
  });

  it('should recognise names the old sync generated', () => {
    expect(
      isRawBillionRegionName(
        'Global 67-3GB/day,128kbps-eSIM Carrier of 90 days',
      ),
    ).toBe(true);
    expect(isRawBillionRegionName('Global 67 Destinations')).toBe(false);
  });
});
