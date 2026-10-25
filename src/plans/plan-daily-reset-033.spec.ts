import { PlanEntity } from './infrastructure/persistence/relational/entities/plan.entity';
import { PlansRelationalRepository } from './infrastructure/persistence/relational/repositories/plan.repository';
import {
  DailyResetPolicyEnum,
  billionDailyReset,
  microEsimDailyReset,
} from './plan-daily-reset';

/**
 * vande #033 — "Giờ làm mới mỗi ngày" vanished from almost every plan on
 * production: each supplier re-sync passed the field as undefined and the
 * update wrote null over it. Billion / MicroEsim now read it from their API.
 */
describe('daily reset (vande #033)', () => {
  describe('plan update keeps fields the caller did not send', () => {
    it('should not blank dailyResetPolicy when the payload leaves it undefined', async () => {
      const stored = Object.assign(new PlanEntity(), {
        id: 7,
        provider: 'esimaccess',
        name: 'Japan 1GB 7Days',
        dailyResetPolicy: 'rolling_24h',
        dailyResetUtcOffset: null,
      });
      const saved: PlanEntity[] = [];
      const typeorm = {
        findOne: jest.fn().mockResolvedValue(stored),
        create: jest.fn((e: PlanEntity) => e),
        save: jest.fn((e: PlanEntity) => {
          saved.push(e);
          return Promise.resolve(e);
        }),
      };
      const repo = new PlansRelationalRepository(typeorm as any);

      await repo.update(7, {
        name: 'Japan 1GB 7 Days',
        dailyResetPolicy: undefined,
        dailyResetUtcOffset: undefined,
      });

      expect(saved[0].name).toBe('Japan 1GB 7 Days');
      expect(saved[0].dailyResetPolicy).toBe('rolling_24h');
    });

    it('should still clear a field sent as an explicit null', async () => {
      const stored = Object.assign(new PlanEntity(), {
        id: 7,
        dailyResetPolicy: 'calendar_day',
        dailyResetUtcOffset: 7,
      });
      const typeorm = {
        findOne: jest.fn().mockResolvedValue(stored),
        create: jest.fn((e: PlanEntity) => e),
        save: jest.fn((e: PlanEntity) => Promise.resolve(e)),
      };
      const repo = new PlansRelationalRepository(typeorm as any);

      const updated = await repo.update(7, {
        dailyResetPolicy: null,
        dailyResetUtcOffset: null,
      });

      expect(updated.dailyResetPolicy).toBeNull();
      expect(updated.dailyResetUtcOffset).toBeNull();
    });
  });

  describe('MicroEsim usage_reset', () => {
    it.each([
      ['24Hrs', DailyResetPolicyEnum.Rolling24h, null],
      ['0:00 (UTC+8)', DailyResetPolicyEnum.CalendarDay, 8],
      ['0:00 (UTC+7)', DailyResetPolicyEnum.CalendarDay, 7],
      ['0:00 (UTC+0)', DailyResetPolicyEnum.CalendarDay, 0],
      ['0:00 (UTC+3)', DailyResetPolicyEnum.CalendarDay, 3],
      // 23:00 in UTC+9 is midnight in UTC+10.
      ['23:00 (UTC+9)', DailyResetPolicyEnum.CalendarDay, 10],
    ])('should read %s', (raw, policy, offset) => {
      expect(microEsimDailyReset(raw)).toEqual({
        dailyResetPolicy: policy,
        dailyResetUtcOffset: offset,
      });
    });

    it('should return no keys for empty or unknown wording', () => {
      expect(microEsimDailyReset(undefined)).toEqual({});
      expect(microEsimDailyReset('')).toEqual({});
      expect(microEsimDailyReset('monthly')).toEqual({});
    });
  });

  describe('Billion', () => {
    const desc =
      'Daily high speed data cap 1GB <br>*Natural Day means 00:00-24:00 based on “UTC+8” TimeZone';

    it('should read "Natural Day" plans as a calendar day in the product timezone', () => {
      expect(
        billionDailyReset({
          name: 'Korea-1GB/Natural day+eSIM Carrier of 90 days',
          planType: '1',
          timeZone: 'UTC+9',
        }),
      ).toEqual({
        dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
        dailyResetUtcOffset: 9,
      });
      expect(
        billionDailyReset({
          name: 'USA-1GB/day',
          desc,
          planType: '1',
          timeZone: 'UTC-8',
        }),
      ).toEqual({
        dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
        dailyResetUtcOffset: -8,
      });
    });

    it('should trust highSpeedDataResetTimeType "2" and falls back to China time', () => {
      expect(
        billionDailyReset({
          name: 'Japan-2GB/day',
          planType: '1',
          highSpeedDataResetTimeType: '2',
        }),
      ).toEqual({
        dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
        dailyResetUtcOffset: 8,
      });
    });

    it('should treat other daily plans as a 24-hour cycle', () => {
      expect(
        billionDailyReset({
          name: 'South Africa-1GB/day-eSIM Carrier of 90 days',
          planType: '1',
          timeZone: 'UTC+8',
        }),
      ).toEqual({
        dailyResetPolicy: DailyResetPolicyEnum.Rolling24h,
        dailyResetUtcOffset: null,
      });
    });

    it('should give total-allowance plans no reset', () => {
      expect(
        billionDailyReset({ name: 'China-SGIP-1GB', planType: '0' }),
      ).toEqual({});
    });
  });
});
