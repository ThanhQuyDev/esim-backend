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

  it('should treat a sold local eSIM as in use, and a domestic one as never expiring', () => {
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
    ).toBe('active');
  });

  it('should start a Viettel eSIM expiry from the sale, and clear a domestic one', () => {
    expect(localEsimExpiry({ durationDays: 15 }, NOW)).toEqual({
      expiresAt: new Date('2026-10-25T00:00:00Z'),
    });
    expect(
      localEsimExpiry({ isDomesticEsim: true, durationDays: 30 }, NOW),
    ).toEqual({
      expiresAt: null,
    });
  });
});
