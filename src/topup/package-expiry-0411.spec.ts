import { withExpiryAfter } from './package-expiry';
import { billionAddonData } from './billion-addon';
import { billionRechargeVariants } from '../esim-providers/billion/billion-catalogue';

const NOW = new Date('2026-11-02T00:00:00Z');
const CURRENT = new Date('2026-11-08T00:00:00Z');

describe('Nhãn hạn dùng khi mua thêm (vande-0411 #021)', () => {
  it('should give a top-up its new date, line by line', () => {
    const [short, long] = withExpiryAfter(
      [{ durationDays: 7 }, { durationDays: 15 }],
      { current: CURRENT, billionFixed: false, now: NOW },
    );

    expect(short.expiresAfter).toBe('2026-11-15T00:00:00.000Z');
    expect(long.expiresAfter).toBe('2026-11-23T00:00:00.000Z');
  });

  it('should keep the date on an add-on', () => {
    const [addon] = withExpiryAfter([{ kind: 'addon', durationDays: 3 }], {
      current: CURRENT,
      billionFixed: true,
      now: NOW,
    });

    expect(addon.expiresAfter).toBe('2026-11-08T00:00:00.000Z');
    expect(addon.startsAfterCurrent).toBe(false);
  });

  it('should count from today once the eSIM has run out', () => {
    const [topup] = withExpiryAfter([{ durationDays: 5 }], {
      current: new Date('2026-10-01T00:00:00Z'),
      billionFixed: false,
      now: NOW,
    });

    expect(topup.expiresAfter).toBe('2026-11-07T00:00:00.000Z');
  });

  it('should promise no date before the eSIM is switched on', () => {
    const [topup] = withExpiryAfter([{ durationDays: 5 }], {
      current: null,
      billionFixed: false,
      now: NOW,
    });

    expect(topup.expiresAfter).toBeNull();
  });

  it('should warn on a Billion fixed top-up only', () => {
    const [topup] = withExpiryAfter([{ durationDays: 5 }], {
      current: CURRENT,
      billionFixed: true,
      now: NOW,
    });

    expect(topup.startsAfterCurrent).toBe(true);
  });
});

describe('Billion chỉ thấy 1 gói topup (vande-0411 #021)', () => {
  // As F052 + F002 + F003 answered on beta on 05/11 for a Vietnam 1GB/day eSIM.
  const DAILY = {
    skuId: '1793268348767286',
    name: 'Vietnam-1GB/Natural day',
    type: '110',
    planType: '1',
    days: '1',
    capacity: '-1',
    highFlowSize: '1048576',
  };
  const rows = [1, 2, 3].map((copies) => ({
    copies: String(copies),
    settlementPrice: String(copies * 10),
  }));

  it('should offer every day count Billion prices on a daily recharge', () => {
    const variants = billionRechargeVariants(
      DAILY as never,
      { skuId: DAILY.skuId, price: rows } as never,
    );

    expect(variants.map((v) => v.durationDays)).toEqual([1, 2, 3]);
    expect(variants.map((v) => v.providerPlanId)).toEqual([
      '1793268348767286',
      '1793268348767286:2',
      '1793268348767286:3',
    ]);
    expect(variants[1].cost).toBe(20);
    expect(variants[1].dataMb).toBe(1024);
  });

  it('should leave a fixed recharge as one package', () => {
    const variants = billionRechargeVariants(
      {
        ...DAILY,
        planType: '0',
        capacity: '5242880',
        highFlowSize: '',
      } as never,
      { skuId: DAILY.skuId, price: rows } as never,
    );

    expect(variants).toHaveLength(1);
  });
});

describe('Nhãn data của add-on Billion (vande-0411 #021)', () => {
  it('should read 1 GB a day when Billion says capacity -1', () => {
    expect(
      billionAddonData({ capacity: '-1', highFlowSize: '1048576' } as never),
    ).toEqual({ bytes: 1024 ** 3, perDay: true });
  });
});
