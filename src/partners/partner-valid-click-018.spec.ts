import {
  CLICK_CONFIRM_WINDOW_MS,
  PartnersService,
  landingDropRate,
} from './partners.service';
import { signClickToken } from './partner-click-token';

/**
 * doitac-3010 #018, rule 2 — a hit of /go is a raw click; it becomes a valid
 * click only when its landing page confirms it was really shown. A HEAD, a bot
 * or a prefetch never runs the page, so it never gets that far.
 */

const CLICK_ID = 'c'.repeat(32);
const UA = 'Mozilla/5.0 (iPhone) Safari';

function buildService(
  click: Record<string, unknown> | null = {
    id: 5,
    linkId: 11,
    signed: true,
    confirmedAt: null,
    userAgent: UA,
    clickedAt: new Date(Date.now() - 5_000),
  },
  affected = 1,
) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const update = jest.fn().mockResolvedValue({ affected });
  const increment = jest.fn().mockResolvedValue(undefined);
  Object.assign(service, {
    linkClickRepository: {
      findOne: jest.fn().mockResolvedValue(click),
      update,
    },
    linkRepository: { increment },
  });
  return { service, update, increment };
}

describe('Valid clicks (doitac-3010 #018)', () => {
  it('should make the click valid once its page confirms it', async () => {
    const { service, update, increment } = buildService();
    await expect(
      service.confirmClick(signClickToken(CLICK_ID), { userAgent: UA }),
    ).resolves.toEqual({ confirmed: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 }),
      expect.objectContaining({ confirmedAt: expect.any(Date) }),
    );
    expect(increment).toHaveBeenCalledWith({ id: 11 }, 'validClickCount', 1);
  });

  it('should count a click once, however many tabs confirm it', async () => {
    const { service, increment } = buildService(undefined, 0);
    await expect(
      service.confirmClick(signClickToken(CLICK_ID), { userAgent: UA }),
    ).resolves.toEqual({ confirmed: false, reason: 'already' });
    expect(increment).not.toHaveBeenCalled();
  });

  it('should refuse a forged or missing token', async () => {
    const { service, increment } = buildService();
    for (const token of [
      undefined,
      CLICK_ID,
      `v1.k0.${CLICK_ID}.${'x'.repeat(32)}`,
    ]) {
      await expect(service.confirmClick(token)).resolves.toEqual({
        confirmed: false,
        reason: 'invalid_token',
      });
    }
    expect(increment).not.toHaveBeenCalled();
  });

  it('should refuse a click confirmed long after it was made', async () => {
    const { service, increment } = buildService({
      id: 5,
      linkId: 11,
      signed: true,
      confirmedAt: null,
      userAgent: UA,
      clickedAt: new Date(Date.now() - CLICK_CONFIRM_WINDOW_MS - 1_000),
    });
    await expect(
      service.confirmClick(signClickToken(CLICK_ID), { userAgent: UA }),
    ).resolves.toEqual({ confirmed: false, reason: 'too_late' });
    expect(increment).not.toHaveBeenCalled();
  });

  it('should refuse a confirmation from another browser', async () => {
    const { service, increment } = buildService();
    await expect(
      service.confirmClick(signClickToken(CLICK_ID), {
        userAgent: 'python-requests/2.31',
      }),
    ).resolves.toEqual({ confirmed: false, reason: 'other_browser' });
    expect(increment).not.toHaveBeenCalled();
  });

  it('should refuse a click the server never minted', async () => {
    const { service } = buildService(null);
    await expect(
      service.confirmClick(signClickToken(CLICK_ID), { userAgent: UA }),
    ).resolves.toEqual({ confirmed: false, reason: 'unknown_click' });
  });

  it('should work out the share dropped before the landing page', () => {
    expect(landingDropRate(0, 0)).toBeNull();
    expect(landingDropRate(10, 10)).toBe(0);
    expect(landingDropRate(8, 6)).toBe(25);
    expect(landingDropRate(3, 1)).toBe(66.7);
    // Old clicks were all counted valid; never below zero.
    expect(landingDropRate(5, 7)).toBe(0);
  });
});
