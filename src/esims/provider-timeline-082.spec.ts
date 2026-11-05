import { zonelessUtcToIso } from './provider-timeline';

describe('zonelessUtcToIso (vande-0411 #082)', () => {
  it('should read a time with no zone as UTC', () => {
    expect(zonelessUtcToIso('2026-11-11 13:00:03')).toBe(
      '2026-11-11T13:00:03.000Z',
    );
  });

  it('should keep a time that states its zone', () => {
    expect(zonelessUtcToIso('2026-11-11T13:00:03+07:00')).toBe(
      '2026-11-11T06:00:03.000Z',
    );
  });

  it.each([null, undefined, '', 'not a date'])(
    'should give null for %s',
    (value) => {
      expect(zonelessUtcToIso(value)).toBeNull();
    },
  );
});
