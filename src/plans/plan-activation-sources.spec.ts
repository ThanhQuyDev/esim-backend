import { billionActivationUntil } from '../esim-providers/billion/billion-catalogue';
import { earliestActivationDeadline } from './plan-activation';

/**
 * #047 (test round 4) — "Kích hoạt eSIM trước ngày …" from each supplier's own
 * data instead of a flat "180 ngày kể từ ngày mua".
 */
describe('Activation deadline sources (#047)', () => {
  describe("Billion's validityPeriod", () => {
    it('should read the date in the product timezone', () => {
      // 23:59:59 in UTC+8 is 15:59:59 UTC the same day.
      expect(
        billionActivationUntil('2028-07-22 23:59:59', 'UTC+8')?.toISOString(),
      ).toBe('2028-07-22T15:59:59.000Z');
    });

    it('should assume China time when no timezone is given', () => {
      expect(
        billionActivationUntil('2027-10-10 03:00:00', null)?.toISOString(),
      ).toBe('2027-10-09T19:00:00.000Z');
    });

    it('should know nothing from an empty value', () => {
      expect(billionActivationUntil('', 'UTC+8')).toBeNull();
      expect(billionActivationUntil(null, null)).toBeNull();
    });
  });

  describe('earliest of the rolling window and a fixed date', () => {
    const now = new Date('2026-10-10T03:00:00Z');

    it('should use the fixed date when it comes first', () => {
      expect(
        earliestActivationDeadline(
          '2027-04-08',
          new Date('2026-12-31T16:59:59Z'),
          now,
        ),
      ).toBe('2026-12-31');
    });

    it('should use the rolling window when it comes first', () => {
      expect(
        earliestActivationDeadline(
          '2026-11-09',
          new Date('2028-07-22T15:59:59Z'),
          now,
        ),
      ).toBe('2026-11-09');
    });

    it('should ignore a fixed date already past', () => {
      expect(
        earliestActivationDeadline(null, new Date('2025-12-05T00:00:00Z'), now),
      ).toBeNull();
    });

    it('should use the fixed date alone when there is no window', () => {
      expect(
        earliestActivationDeadline(null, new Date('2027-10-09T19:00:00Z'), now),
      ).toBe('2027-10-10');
    });
  });
});
