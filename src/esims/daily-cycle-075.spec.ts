import { derivedExpiry } from './daily-cycle';

/** When a plan runs out, counted the way it counts its days (vande #075). */
describe('derivedExpiry (vande #075)', () => {
  // 25/10 23:00 in Vietnam = 25/10 16:00 UTC = 26/10 00:00 in UTC+8.
  const late = '2026-10-25T16:00:00.000Z';

  it('should give a 24-hour plan whole 24-hour days from the first connection', () => {
    expect(derivedExpiry(late, 3, 'rolling_24h', null)?.toISOString()).toBe(
      '2026-10-28T16:00:00.000Z',
    );
  });

  it('should end a UTC+8 calendar-day plan at midnight in UTC+8', () => {
    // Connected at 26/10 00:00 UTC+8 — day one is 26/10 there; three days end
    // at 29/10 00:00 UTC+8 = 28/10 16:00 UTC.
    expect(derivedExpiry(late, 3, 'calendar_day', 8)?.toISOString()).toBe(
      '2026-10-28T16:00:00.000Z',
    );
  });

  it('should count the connection day as day one however late it is', () => {
    // 25/10 23:30 in Vietnam: day one of a UTC+7 plan is 25/10, so a 2-day
    // plan ends at 27/10 00:00 UTC+7 = 26/10 17:00 UTC — 25.5 hours later.
    expect(
      derivedExpiry(
        '2026-10-25T16:30:00.000Z',
        2,
        'calendar_day',
        7,
      )?.toISOString(),
    ).toBe('2026-10-26T17:00:00.000Z');
  });

  it('should read a western offset too', () => {
    // 25/10 16:00 UTC is 25/10 08:00 in UTC-8; one day ends 26/10 00:00 UTC-8.
    expect(derivedExpiry(late, 1, 'calendar_day', -8)?.toISOString()).toBe(
      '2026-10-26T08:00:00.000Z',
    );
  });

  it('should fall back to 24-hour days when the plan does not say', () => {
    expect(derivedExpiry(late, 1, null, null)?.toISOString()).toBe(
      '2026-10-26T16:00:00.000Z',
    );
  });

  it('should give nothing without an activation or a length', () => {
    expect(derivedExpiry(null, 3, 'rolling_24h', null)).toBeNull();
    expect(derivedExpiry(late, 0, 'rolling_24h', null)).toBeNull();
  });
});
