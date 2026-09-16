import {
  parseGadgetKoreaUsageMb,
  parseGadgetKoreaUtc,
} from './gadgetkorea.service';

/**
 * Gadget Korea's `usage` field, read as megabytes (#028).
 *
 * `parseFloat` read "1.5GB" as 1.5 MB, so a heavily used eSIM looked untouched.
 */
describe('parseGadgetKoreaUsageMb', () => {
  it.each([
    ['512', 512],
    ['512MB', 512],
    ['1.5GB', 1536],
    ['2048 KB', 2],
    ['1,024 MB', 1024],
    [300, 300],
  ])('should read %p as %p MB', (value, expected) => {
    expect(parseGadgetKoreaUsageMb(value)).toBe(expected);
  });

  it.each([null, undefined, '', 'n/a', '12 parsecs', -5, '-3'])(
    'should read %p as nothing used',
    (value) => {
      expect(parseGadgetKoreaUsageMb(value)).toBe(0);
    },
  );
});

/**
 * Gadget Korea's times are UTC without a zone (#028); `new Date()` would read
 * them as server-local time.
 */
describe('parseGadgetKoreaUtc', () => {
  it.each([
    ['2022-12-09 09:08:20', '2022-12-09T09:08:20.000Z'],
    ['2022-12-09T09:08:20Z', '2022-12-09T09:08:20.000Z'],
    ['2022-12-09 16:08:20+07:00', '2022-12-09T09:08:20.000Z'],
    ['2025-03-08', '2025-03-08T00:00:00.000Z'],
  ])('should read %p as %p', (value, expected) => {
    expect(parseGadgetKoreaUtc(value)).toBe(expected);
  });

  it.each([null, undefined, '', '  ', 'not-a-date'])(
    'should read %p as no time',
    (value) => {
      expect(parseGadgetKoreaUtc(value)).toBeNull();
    },
  );
});
