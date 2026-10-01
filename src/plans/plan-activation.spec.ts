import { PlansService } from './plans.service';
import {
  activationDeadlineFromDays,
  activationDeadlineFromExpiry,
  parseValidityDays,
  vietnamDate,
} from './plan-activation';

/**
 * "Kích hoạt eSIM trước ngày dd/mm/yyyy" (#070).
 *
 * The row these feed used to read "180 ngày kể từ ngày mua" for the whole
 * catalogue while suppliers actually allow 30 to 180 days, so the thing worth
 * protecting is that a date is only ever printed when a supplier really stated
 * the window — a customer reads that date as a promise, and acting on a wrong one
 * costs them the eSIM.
 */
describe('plan activation deadline', () => {
  describe('vietnamDate', () => {
    it('should report the Vietnamese calendar day, not the UTC one', () => {
      // 23:30 UTC is already the next day in Hanoi (UTC+7).
      expect(vietnamDate(new Date('2026-03-30T23:30:00Z'))).toBe('2026-03-31');
      expect(vietnamDate(new Date('2026-03-30T10:00:00Z'))).toBe('2026-03-30');
    });
  });

  describe('from a stated number of days', () => {
    const viewedAt = new Date('2026-03-30T03:00:00Z');

    it('should count the window on from the day the product is viewed', () => {
      expect(activationDeadlineFromDays(180, viewedAt)).toBe('2026-09-26');
      expect(activationDeadlineFromDays(30, viewedAt)).toBe('2026-04-29');
    });

    it('should say nothing when the supplier stated nothing', () => {
      // Airalo and Billion expose no activation window, so their plans must keep
      // the generic wording rather than inherit somebody else's 180 days.
      expect(activationDeadlineFromDays(null, viewedAt)).toBeNull();
      expect(activationDeadlineFromDays(undefined, viewedAt)).toBeNull();
    });

    it('should reject a nonsense window instead of printing a past date', () => {
      expect(activationDeadlineFromDays(0, viewedAt)).toBeNull();
      expect(activationDeadlineFromDays(-5, viewedAt)).toBeNull();
      expect(activationDeadlineFromDays(Number.NaN, viewedAt)).toBeNull();
    });
  });

  describe('from local stock expiry', () => {
    const now = new Date('2026-03-30T03:00:00Z');

    it('should use the printed expiry date, not a count from today', () => {
      expect(
        activationDeadlineFromExpiry(new Date('2026-05-15T00:00:00Z'), now),
      ).toBe('2026-05-15');
    });

    it('should accept the date as a string, the way pg hands it back', () => {
      expect(activationDeadlineFromExpiry('2026-05-15T00:00:00Z', now)).toBe(
        '2026-05-15',
      );
    });

    it('should drop an expiry already in the past', () => {
      // Such stock is not sellable anyway (#021) and a past deadline reads as a bug.
      expect(
        activationDeadlineFromExpiry(new Date('2026-01-01T00:00:00Z'), now),
      ).toBeNull();
    });

    it('should say nothing when there is no expiry to show', () => {
      expect(activationDeadlineFromExpiry(null, now)).toBeNull();
      expect(activationDeadlineFromExpiry('not a date', now)).toBeNull();
    });
  });

  describe('parseValidityDays', () => {
    it('should read a plain number', () => {
      expect(parseValidityDays(180)).toBe(180);
      expect(parseValidityDays('180')).toBe(180);
    });

    it('should pull the number out of a supplier string', () => {
      // MicroEsim sends `validity_period` as free text.
      expect(parseValidityDays('180 days')).toBe(180);
      expect(parseValidityDays('有效期 90 天')).toBe(90);
    });

    it('should return null for text with no number in it', () => {
      expect(parseValidityDays('unlimited')).toBeNull();
      expect(parseValidityDays('')).toBeNull();
      expect(parseValidityDays(null)).toBeNull();
    });

    it('should reject zero and negatives', () => {
      expect(parseValidityDays('0')).toBeNull();
      expect(parseValidityDays(-30)).toBeNull();
    });
  });

  describe('what the storefront is handed', () => {
    const makeService = (stock: Record<number, unknown> = {}) => {
      const plansRepository = {
        findManyWithPagination: jest.fn(),
        countAvailableEsimsByPlanIds: jest.fn().mockResolvedValue(stock),
      };
      const service = new PlansService(
        plansRepository as never,
        { findBySlug: jest.fn() } as never,
        {} as never,
        {} as never,
        {} as never,
        {
          // Faithful to the real service: an empty APN table, i.e. no sheet
          // uploaded yet, so nothing is judged TikTok-capable (#065, #067).
          capabilityMap: jest.fn().mockResolvedValue(new Map()),
          judgePlan: jest.fn().mockReturnValue({
            tiktokIos: false,
            tiktokAndroid: false,
            tiktokAllDevices: false,
            chatGpt: false,
          }),
        } as never,
      );
      return { service, plansRepository };
    };

    /** `attachStorefrontFacts` is private; this is the behaviour of the endpoints. */
    const attach = (service: PlansService, plans: unknown[]) =>
      (
        service as unknown as {
          attachStorefrontFacts: (p: unknown[]) => Promise<unknown[]>;
        }
      ).attachStorefrontFacts(plans);

    it('should give an API plan a deadline counted from now', async () => {
      const { service } = makeService();

      const [plan] = (await attach(service, [
        { id: 1, isLocalInventory: false, activationValidityDays: 180 },
      ])) as { activationDeadline: string | null }[];

      expect(plan.activationDeadline).toBe(
        activationDeadlineFromDays(180, new Date()),
      );
    });

    it('should leave an API plan with no stated window undated', async () => {
      const { service } = makeService();

      const [plan] = (await attach(service, [
        { id: 1, isLocalInventory: false, activationValidityDays: null },
      ])) as { activationDeadline: string | null }[];

      expect(plan.activationDeadline).toBeNull();
    });

    it('should date a local plan from the soonest-expiring eSIM it has left', async () => {
      // Two import batches, two expiries: only the earlier one is true of
      // whichever eSIM the customer is actually handed.
      const { service } = makeService({
        7: { count: 4, earliestExpiresAt: new Date('2099-12-01T00:00:00Z') },
      });

      const [plan] = (await attach(service, [
        { id: 7, isLocalInventory: true, activationValidityDays: null },
      ])) as { activationDeadline: string | null; availableStock: number }[];

      expect(plan.activationDeadline).toBe('2099-12-01');
      expect(plan.availableStock).toBe(4);
    });

    it('should report a sold-out local plan as empty and undated', async () => {
      const { service } = makeService({});

      const [plan] = (await attach(service, [
        { id: 7, isLocalInventory: true },
      ])) as { activationDeadline: string | null; availableStock: number }[];

      expect(plan.availableStock).toBe(0);
      expect(plan.activationDeadline).toBeNull();
    });

    it('should not query stock when nothing is local', async () => {
      const { service, plansRepository } = makeService();

      await attach(service, [{ id: 1, isLocalInventory: false }]);

      expect(
        plansRepository.countAvailableEsimsByPlanIds,
      ).not.toHaveBeenCalled();
    });

    it('should ignore a local plan stated validity in favour of real stock', async () => {
      // Local stock carries a printed date; a day count on the row would be the
      // wrong answer even if something had filled it in.
      const { service } = makeService({
        7: { count: 1, earliestExpiresAt: new Date('2099-07-07T00:00:00Z') },
      });

      const [plan] = (await attach(service, [
        { id: 7, isLocalInventory: true, activationValidityDays: 30 },
      ])) as { activationDeadline: string | null }[];

      expect(plan.activationDeadline).toBe('2099-07-07');
    });
  });
});
