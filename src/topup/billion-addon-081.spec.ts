import {
  billionAddonCopies,
  billionAddonData,
  billionAddonPackageId,
  parseBillionAddonPackageId,
  planTakesAddons,
} from './billion-addon';

/**
 * vande #081: Billion's acceleration packages (F015/F016) as "Mua thêm dung
 * lượng". Billion's rules, from its docs and its reply of 29/10.
 */
describe('Billion add-ons (vande #081)', () => {
  const activatedAt = new Date('2026-10-20T03:00:00Z');

  it('should buy one copy of a one-day boost', () => {
    expect(
      billionAddonCopies({
        dayType: '0',
        originalDays: 7,
        activatedAt,
        now: new Date('2026-10-24T03:00:00Z'),
      }),
    ).toBe(1);
  });

  it('should cover the days left for an upgrade or extra data: original − used + 1', () => {
    // Activated 20/10, now 24/10 → day 5 of a 7-day plan → 7 − 5 + 1 = 3.
    const now = new Date('2026-10-24T05:00:00Z');
    expect(
      billionAddonCopies({ dayType: '1', originalDays: 7, activatedAt, now }),
    ).toBe(3);
    expect(
      billionAddonCopies({ dayType: '2', originalDays: 7, activatedAt, now }),
    ).toBe(3);
    // The day of activation is day 1: the whole plan is left.
    expect(
      billionAddonCopies({
        dayType: '1',
        originalDays: 7,
        activatedAt,
        now: activatedAt,
      }),
    ).toBe(7);
  });

  it('should offer no upgrade once the plan has no day left', () => {
    expect(
      billionAddonCopies({
        dayType: '2',
        originalDays: 3,
        activatedAt,
        now: new Date('2026-10-30T03:00:00Z'),
      }),
    ).toBeNull();
  });

  it('should only sell add-ons on eSIM plans that take them (2 or 3)', () => {
    expect(planTakesAddons(0)).toBe(false);
    expect(planTakesAddons(1)).toBe(false);
    expect(planTakesAddons(2)).toBe(true);
    expect(planTakesAddons(3)).toBe(true);
    // Not synced since the field arrived: ask Billion, which answers for itself.
    expect(planTakesAddons(null)).toBe(true);
  });

  it('should round-trip the package id', () => {
    const id = billionAddonPackageId('1', '1274', 3);
    expect(id).toBe('billion-acc:1:1274:3');
    expect(parseBillionAddonPackageId(id)).toEqual({
      dayType: '1',
      skuId: '1274',
      copies: 3,
    });
    expect(parseBillionAddonPackageId('billion:1274')).toBeNull();
    expect(parseBillionAddonPackageId('billion-acc:9:1274:3')).toBeNull();
  });

  it('should read per-day data from a single-day package and total data otherwise', () => {
    // Billion's own F015 example: 200 MB/day high speed (20000 KB).
    expect(
      billionAddonData({
        skuId: '1274',
        settlementPrice: '11',
        name: 'Hong Kong-4G-1 day-200M',
        planType: '1',
        highFlowSize: '204800',
      }),
    ).toEqual({ bytes: 204800 * 1024, perDay: true });
    expect(
      billionAddonData({
        skuId: '1275',
        settlementPrice: '30',
        name: 'Hong Kong 3GB',
        planType: '0',
        capacity: '3145728',
      }),
    ).toEqual({ bytes: 3 * 1024 * 1024 * 1024, perDay: false });
  });
});
