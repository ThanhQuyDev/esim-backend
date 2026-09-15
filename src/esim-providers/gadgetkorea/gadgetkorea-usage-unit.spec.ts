import { parseGadgetKoreaUsageMb } from './gadgetkorea.service';

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
