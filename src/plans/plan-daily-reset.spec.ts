import { PlansService } from './plans.service';
import { PlanMapper } from './infrastructure/persistence/relational/mappers/plan.mapper';
import { PlanEntity } from './infrastructure/persistence/relational/entities/plan.entity';
import { Plan } from './domain/plan';
import {
  CHINA_UTC_OFFSET,
  DailyResetPolicyEnum,
  VIETNAM_UTC_OFFSET,
  defaultDailyReset,
  defaultDailyResetFields,
  parseDailyResetPolicy,
} from './plan-daily-reset';

/**
 * "Giờ làm mới mỗi ngày" on the plan (#063).
 *
 * The answer matters to a customer deciding when their data comes back, so the
 * two things these tests protect are: a supplier whose policy is a known fact
 * gets it without anybody typing it in, and a supplier that states the cycle per
 * plan is never given a blanket guess.
 */
describe('plan daily reset', () => {
  describe('supplier defaults', () => {
    it('should give the 24-hour cycle to the suppliers that confirmed it', () => {
      for (const provider of ['gadgetkorea', 'esimaccess', 'airalo']) {
        expect(defaultDailyReset(provider)).toEqual({
          dailyResetPolicy: DailyResetPolicyEnum.Rolling24h,
          dailyResetUtcOffset: null,
        });
      }
    });

    it('should count Viettel and domestic eSIMs on the Vietnamese day', () => {
      expect(defaultDailyReset('viettel')).toEqual({
        dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
        dailyResetUtcOffset: VIETNAM_UTC_OFFSET,
      });
      // Domestic stock is sold under several provider names, so the flag decides.
      expect(defaultDailyReset('some-local-carrier', true)).toEqual({
        dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
        dailyResetUtcOffset: VIETNAM_UTC_OFFSET,
      });
    });

    it('should state nothing for the suppliers that send the cycle per plan', () => {
      // Billion puts it in `highSpeedTime` and MicroEsim sends its own; a default
      // here would be overwritten — or worse, kept — on the next sync (#071).
      expect(defaultDailyReset('billion')).toBeNull();
      expect(defaultDailyReset('microesim')).toBeNull();
      expect(defaultDailyReset(null)).toBeNull();
      expect(defaultDailyReset(undefined)).toBeNull();
    });

    it('should not care about the case the provider is written in', () => {
      expect(defaultDailyReset('EsimAccess')?.dailyResetPolicy).toBe(
        DailyResetPolicyEnum.Rolling24h,
      );
    });

    it('should contribute no keys at all when nothing is known', () => {
      // Spread into a sync payload, so an admin's hand-entered value survives
      // instead of being nulled out on every sync.
      expect(defaultDailyResetFields('billion')).toEqual({});
      expect(Object.keys(defaultDailyResetFields('airalo'))).toEqual([
        'dailyResetPolicy',
        'dailyResetUtcOffset',
      ]);
    });
  });

  describe('create', () => {
    const makeService = () => {
      const created: Record<string, unknown>[] = [];
      const plansRepository = {
        findBySlug: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation((data: Record<string, unknown>) => {
            created.push(data);
            return Promise.resolve({ id: created.length, ...data });
          }),
      };
      const service = new PlansService(
        plansRepository as never,
        { findByCountryCode: jest.fn() } as never,
        {} as never,
        {
          calculateRetailVndFromLocalCost: jest.fn().mockResolvedValue(null),
        } as never,
        { getUsdToVndRate: jest.fn().mockResolvedValue(25000) } as never,
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
      return { service, created };
    };

    const BASE = {
      name: 'Unlimited 3 days',
      slug: 'unlimited-3-days',
      durationDays: 3,
      dataMb: 3000,
      costPrice: 6,
      price: 6,
      retailPrice: 11,
      providerPlanId: 'p-1',
    };

    it('should fill in what the supplier is known to do', async () => {
      const { service, created } = makeService();

      await service.create({ ...BASE, provider: 'airalo' } as never);

      expect(created[0]).toMatchObject({
        dailyResetPolicy: DailyResetPolicyEnum.Rolling24h,
        dailyResetUtcOffset: null,
      });
    });

    it('should let an explicit value win over the supplier default', async () => {
      const { service, created } = makeService();

      await service.create({
        ...BASE,
        provider: 'airalo',
        dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
        dailyResetUtcOffset: CHINA_UTC_OFFSET,
      } as never);

      expect(created[0]).toMatchObject({
        dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
        dailyResetUtcOffset: CHINA_UTC_OFFSET,
      });
    });

    it('should count a domestic plan on the Vietnamese day', async () => {
      const { service, created } = makeService();

      await service.create({
        ...BASE,
        provider: 'viettel',
        currency: 'VND',
        isLocalInventory: true,
      } as never);

      expect(created[0]).toMatchObject({
        dailyResetPolicy: DailyResetPolicyEnum.CalendarDay,
        dailyResetUtcOffset: VIETNAM_UTC_OFFSET,
      });
    });

    it('should leave it unstated for a supplier that has not said', async () => {
      const { service, created } = makeService();

      await service.create({ ...BASE, provider: 'billion' } as never);

      expect(created[0]).toMatchObject({
        dailyResetPolicy: null,
        dailyResetUtcOffset: null,
      });
    });
  });

  describe('reading a supplier’s own wording', () => {
    it('should recognise a 24-hour cycle however it is written', () => {
      // The GadgetKorea "Initialize policy" column (#071).
      for (const raw of [
        'reset 24h',
        'Reset 24H',
        '24 hours',
        'every 24 hour',
        'làm mới sau 24 giờ',
      ]) {
        expect(parseDailyResetPolicy(raw)).toBe(
          DailyResetPolicyEnum.Rolling24h,
        );
      }
    });

    it('should recognise a calendar day however it is written', () => {
      for (const raw of [
        'calendar day',
        'Natural day',
        'resets at midnight',
        'ends 23:59',
        'theo ngày tự nhiên',
      ]) {
        expect(parseDailyResetPolicy(raw)).toBe(
          DailyResetPolicyEnum.CalendarDay,
        );
      }
    });

    it('should refuse to guess at wording it does not recognise', () => {
      // This feeds a sentence telling a customer when their data comes back, so
      // an unrecognised value must fall through to the supplier default rather
      // than be forced into one of the two buckets.
      expect(parseDailyResetPolicy('standard')).toBeNull();
      expect(parseDailyResetPolicy('12 hours')).toBeNull();
      expect(parseDailyResetPolicy('')).toBeNull();
      expect(parseDailyResetPolicy(null)).toBeNull();
      expect(parseDailyResetPolicy(undefined)).toBeNull();
    });
  });

  describe('mapper', () => {
    const rawPlan = (over: Partial<PlanEntity>): PlanEntity =>
      ({
        id: 1,
        provider: 'airalo',
        tags: null,
        apn: null,
        dailyResetPolicy: null,
        dailyResetUtcOffset: null,
        ...over,
      }) as PlanEntity;

    it('should read a stored policy back out', () => {
      const domain = PlanMapper.toDomain(
        rawPlan({ dailyResetPolicy: 'calendar_day', dailyResetUtcOffset: 8 }),
      );

      expect(domain.dailyResetPolicy).toBe(DailyResetPolicyEnum.CalendarDay);
      expect(domain.dailyResetUtcOffset).toBe(8);
    });

    it('should treat an unrecognised policy as unstated', () => {
      // A hand-edited row or a value an older build wrote: the storefront has no
      // copy for it, so passing it through would print a raw token to customers.
      const domain = PlanMapper.toDomain(
        rawPlan({ dailyResetPolicy: 'weekly' }),
      );

      expect(domain.dailyResetPolicy).toBeNull();
    });

    it('should write both columns back', () => {
      const domain = new Plan();
      Object.assign(domain, {
        tags: null,
        apn: 'internet',
        dailyResetPolicy: DailyResetPolicyEnum.Rolling24h,
        dailyResetUtcOffset: null,
      });

      const persistence = PlanMapper.toPersistence(domain);

      expect(persistence.dailyResetPolicy).toBe(
        DailyResetPolicyEnum.Rolling24h,
      );
      expect(persistence.dailyResetUtcOffset).toBeNull();
    });
  });
});
