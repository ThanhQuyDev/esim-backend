import { esimLifecycleStatus } from './esim-lifecycle';
import { localEsimExpiry } from '../orders/orders.service';

const NOW = new Date('2026-10-10T00:00:00Z');
const past = new Date('2026-10-01T00:00:00Z');
const future = new Date('2026-10-20T00:00:00Z');
const travel = { isLocalInventory: false, isDomesticEsim: false };
const viettel = { isLocalInventory: true, isDomesticEsim: false };
const domestic = { isLocalInventory: true, isDomesticEsim: true };

describe('eSIM lifecycle status (#024, test round 4)', () => {
  it('should follow the customer rules for supplier eSIMs', () => {
    expect(esimLifecycleStatus({ status: 'sold' }, travel, NOW)).toBe('sold');
    expect(
      esimLifecycleStatus(
        { status: 'sold', activatedAt: past, expiresAt: future },
        travel,
        NOW,
      ),
    ).toBe('active');
    expect(
      esimLifecycleStatus(
        { status: 'sold', activatedAt: past, expiresAt: past },
        travel,
        NOW,
      ),
    ).toBe('expired');
    expect(esimLifecycleStatus({ status: 'refunded' }, travel, NOW)).toBe(
      'refunded',
    );
    expect(esimLifecycleStatus({ status: 'cancelled' }, travel, NOW)).toBe(
      'deactivated',
    );
  });

  it('should treat a sold local eSIM as in use until its date, domestic too (vande #002)', () => {
    expect(esimLifecycleStatus({ status: 'available' }, viettel, NOW)).toBe(
      'available',
    );
    expect(
      esimLifecycleStatus({ status: 'sold', expiresAt: future }, viettel, NOW),
    ).toBe('active');
    expect(
      esimLifecycleStatus({ status: 'sold', expiresAt: past }, viettel, NOW),
    ).toBe('expired');
    expect(
      esimLifecycleStatus({ status: 'sold', expiresAt: past }, domestic, NOW),
    ).toBe('expired');
    expect(
      esimLifecycleStatus({ status: 'sold', expiresAt: future }, domestic, NOW),
    ).toBe('active');
  });

  it('should date a sold local eSIM from the sale, Viettel and domestic alike', () => {
    for (const plan of [
      { durationDays: 15 },
      { isDomesticEsim: true, durationDays: 15 },
    ]) {
      expect(localEsimExpiry(plan, NOW)).toEqual({
        createdAt: NOW,
        installedAt: NOW,
        activatedAt: NOW,
        expiresAt: new Date('2026-10-25T00:00:00Z'),
      });
    }
  });

  it('should leave the end open when the plan has no length', () => {
    expect(localEsimExpiry({ durationDays: 0 }, NOW)).not.toHaveProperty(
      'expiresAt',
    );
  });
});

describe('eSIMs a supplier delivered as "available" (doitac-3010 #006)', () => {
  it('should call an ordered eSIM sold, not stock', () => {
    expect(
      esimLifecycleStatus({ status: 'available', orderItemId: 5 }, travel, NOW),
    ).toBe('sold');
    expect(esimLifecycleStatus({ status: 'available' }, travel, NOW)).toBe(
      'available',
    );
  });

  it('should call an eSIM with data spent in use, even with no activation date', () => {
    expect(
      esimLifecycleStatus(
        { status: 'available', orderItemId: 5, dataUsed: '303.98' },
        travel,
        NOW,
      ),
    ).toBe('active');
    expect(
      esimLifecycleStatus(
        { status: 'sold', orderItemId: 5, dataUsed: '0' },
        travel,
        NOW,
      ),
    ).toBe('sold');
  });
});
