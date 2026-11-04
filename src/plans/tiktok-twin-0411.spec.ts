import { tiktokReplacements } from './plans.service';

/**
 * vande-0411 #032 — the cheap regular plan is what everyone sees, and the
 * TikTok & AI filter must swap in one that works, never leave the regular one.
 */
const WORKS = { tiktokAllDevices: true, chatGpt: true };
const plan = (id: number, over: Record<string, unknown>) =>
  ({
    id,
    destinationId: 1,
    type: 'unlimited-reduce',
    durationDays: 1,
    dataMb: 1024,
    isCheapest: false,
    appSupport: { tiktokAllDevices: false, chatGpt: false },
    vndCostPrice: 21000,
    ...over,
  }) as never;

describe('Gói thường và gói nonhkip (vande-0411 #032)', () => {
  const regular = plan(1, { isCheapest: true, provider: 'esimaccess' });
  const nonhkip = plan(2, {
    provider: 'esimaccess',
    vndCostPrice: 24000,
    appSupport: WORKS,
  });

  it('should offer the nonhkip plan when the cheap one cannot do TikTok', () => {
    expect(tiktokReplacements([regular, nonhkip])).toEqual([nonhkip]);
  });

  it('should never hand back a plan that does not work', () => {
    expect(tiktokReplacements([regular])).toEqual([]);
  });

  it('should take the cheaper of another supplier that works', () => {
    const billion = plan(3, {
      provider: 'billion',
      vndCostPrice: 22000,
      appSupport: WORKS,
    });

    expect(tiktokReplacements([regular, nonhkip, billion])).toEqual([billion]);
  });

  it('should add nothing when the plan shown already works', () => {
    const shown = plan(4, { isCheapest: true, appSupport: WORKS });

    expect(tiktokReplacements([shown, nonhkip])).toEqual([]);
  });

  it('should keep other days and data apart', () => {
    const otherDays = plan(5, { durationDays: 3, appSupport: WORKS });

    expect(tiktokReplacements([regular, otherDays])).toEqual([otherDays]);
  });
});
