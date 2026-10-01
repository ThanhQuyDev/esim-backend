import { PlansService } from './plans.service';
import type { ApnCapabilities } from '../apn-support/apn-support.types';
import { ApnSupportService } from '../apn-support/apn-support.service';

/**
 * What the storefront is handed about TikTok / ChatGPT support (#067).
 *
 * Two things are being protected. First, every plan carries a verdict that comes
 * from the uploaded APN table (or the esimaccess "nonhkip" marker) rather than
 * from anything the frontend guesses. Second — and this is the defect found while
 * reading #064 — a TikTok-capable plan that LOST the price de-duplication never
 * reached the storefront at all, so the "works with TikTok" filter could not show
 * it however it was written. Those plans come back in their own list.
 */
describe('TikTok support on the storefront payload', () => {
  /** The real judging logic, over a small APN table. */
  const apnService = new ApnSupportService({
    findAll: jest.fn(),
    findAllWithPagination: jest.fn(),
    findByApn: jest.fn(),
    replaceAll: jest.fn(),
    count: jest.fn(),
  } as never);

  const caps = (
    tiktok: [boolean, boolean],
    chatGpt: [boolean, boolean],
  ): ApnCapabilities => ({
    tiktok: { ios: tiktok[0], android: tiktok[1] },
    chatGpt: { ios: chatGpt[0], android: chatGpt[1] },
    gemini: { ios: true, android: true },
    claude: { ios: false, android: false },
  });

  const TABLE = new Map<string, ApnCapabilities>([
    ['works', caps([true, true], [true, true])],
    // The worked example: iPhone only, so not a "works on every device" plan.
    ['cmhk', caps([true, false], [true, true])],
    ['gpt-only', caps([false, false], [true, true])],
  ]);

  const makeService = (plans: Record<string, unknown>[]) => {
    const plansRepository = {
      findManyWithPagination: jest
        .fn()
        .mockResolvedValue([plans, plans.length]),
      countAvailableEsimsByPlanIds: jest.fn().mockResolvedValue({}),
    };
    const service = new PlansService(
      plansRepository as never,
      { findBySlug: jest.fn().mockResolvedValue({ id: 1 }) } as never,
      {} as never,
      {} as never,
      {} as never,
      {
        capabilityMap: jest.fn().mockResolvedValue(TABLE),
        judgePlan: (plan: never, caps: never) =>
          apnService.judgePlan(plan, caps),
      } as never,
    );
    return service;
  };

  const plan = (over: Record<string, unknown>) => ({
    id: 1,
    type: 'fixed',
    isCheapest: true,
    isLocalInventory: false,
    sms: null,
    call: null,
    apn: null,
    activationValidityDays: null,
    ...over,
  });

  const groupsFor = (plans: Record<string, unknown>[]) =>
    makeService(plans).findPlansByDestination('japan');

  it('should hand every plan a verdict, not just the capable ones', async () => {
    const groups = await groupsFor([
      plan({ id: 1, apn: 'works' }),
      plan({ id: 2, apn: 'gpt-only' }),
    ]);

    expect(groups.dataPlans[0].appSupport).toEqual({
      tiktokIos: true,
      tiktokAndroid: true,
      tiktokAllDevices: true,
      chatGpt: true,
      known: true,
    });
    expect(groups.dataPlans[1].appSupport).toMatchObject({
      tiktokAllDevices: false,
      chatGpt: true,
    });
  });

  it('should take esimaccess at its word via the nonhkip marker', async () => {
    // They send no APN at all (#041).
    const groups = await groupsFor([
      plan({ id: 1, apn: null, isNonHkIp: true }),
    ]);

    expect(groups.dataPlans[0].appSupport?.tiktokAllDevices).toBe(true);
  });

  it('should return a TikTok plan that lost the price de-duplication', async () => {
    // The whole point: this plan never reached the storefront before, because
    // `dataPlans` only carries the cheapest of each configuration.
    const groups = await groupsFor([
      plan({ id: 1, apn: 'gpt-only', isCheapest: true }),
      plan({ id: 2, apn: 'works', isCheapest: false }),
    ]);

    expect(groups.dataPlans.map((p) => p.id)).toEqual([1]);
    expect(groups.tiktokHiddenByPrice.map((p) => p.id)).toEqual([2]);
  });

  it('should leave the default view exactly as it was', async () => {
    // #068 says the page still shows the price-de-duplicated list by default, so
    // the extra plans must not leak into `dataPlans`.
    const groups = await groupsFor([
      plan({ id: 1, apn: 'works', isCheapest: true }),
      plan({ id: 2, apn: 'works', isCheapest: false }),
    ]);

    expect(groups.dataPlans.map((p) => p.id)).toEqual([1]);
    expect(groups.tiktokHiddenByPrice.map((p) => p.id)).toEqual([2]);
  });

  it('should not offer a plan that only works on one platform', async () => {
    // `cmhk` works on iPhone but not Android, and the page does not know what the
    // visitor is holding — so it is not a "works with TikTok" plan to surface.
    const groups = await groupsFor([
      plan({ id: 1, apn: 'gpt-only', isCheapest: true }),
      plan({ id: 2, apn: 'cmhk', isCheapest: false }),
    ]);

    expect(groups.tiktokHiddenByPrice).toEqual([]);
    expect(groups.dataPlans[0].appSupport?.tiktokIos).toBe(false);
  });

  it('should not look in the unlimited groups, which are never de-duplicated', async () => {
    // Only `dataPlans` is filtered by isCheapest, so only it can hide a plan.
    const groups = await groupsFor([
      plan({ id: 1, type: 'unlimited', apn: 'works', isCheapest: false }),
    ]);

    expect(groups.dailyUnlimited.map((p) => p.id)).toEqual([1]);
    expect(groups.tiktokHiddenByPrice).toEqual([]);
  });

  it('should find nothing capable before a sheet is uploaded', async () => {
    const service = new PlansService(
      {
        findManyWithPagination: jest
          .fn()
          .mockResolvedValue([[plan({ id: 1, apn: 'works' })], 1]),
        countAvailableEsimsByPlanIds: jest.fn().mockResolvedValue({}),
      } as never,
      { findBySlug: jest.fn().mockResolvedValue({ id: 1 }) } as never,
      {} as never,
      {} as never,
      {} as never,
      {
        capabilityMap: jest.fn().mockResolvedValue(new Map()),
        judgePlan: (p: never, caps: never) => apnService.judgePlan(p, caps),
      } as never,
    );

    const groups = await service.findPlansByDestination('japan');

    expect(groups.dataPlans[0].appSupport?.chatGpt).toBe(false);
    expect(groups.tiktokHiddenByPrice).toEqual([]);
  });

  it('should read the APN table once for the whole page', async () => {
    // Not once per plan: a destination page can carry dozens.
    const capabilityMap = jest.fn().mockResolvedValue(TABLE);
    const service = new PlansService(
      {
        findManyWithPagination: jest
          .fn()
          .mockResolvedValue([
            [plan({ id: 1, apn: 'works' }), plan({ id: 2, apn: 'cmhk' })],
            2,
          ]),
        countAvailableEsimsByPlanIds: jest.fn().mockResolvedValue({}),
      } as never,
      { findBySlug: jest.fn().mockResolvedValue({ id: 1 }) } as never,
      {} as never,
      {} as never,
      {} as never,
      {
        capabilityMap,
        judgePlan: (p: never, caps: never) => apnService.judgePlan(p, caps),
      } as never,
    );

    await service.findPlansByDestination('japan');

    expect(capabilityMap).toHaveBeenCalledTimes(1);
  });
});
