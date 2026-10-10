import { isNonHkExit } from './esimaccess.service';

/**
 * #043 (test round 4) — TikTok and ChatGPT work on an esimaccess eSIM unless its
 * traffic exits via Hong Kong. Judged from the package's `ipExport`; the
 * "(nonhkip)" name marker only when no IP is reported.
 */
describe('isNonHkExit (#043)', () => {
  it.each([
    ['SG', true],
    ['FR/NL/UK', true],
    ['UK', true],
    ['HK', false],
    ['hk', false],
    ['SG/HK', false],
  ])('should treat exit IP %s as non-HK = %s', (ipExport, expected) => {
    expect(isNonHkExit({ ipExport, name: 'China 1GB 7Days' })).toBe(expected);
  });

  it('should fall back to the (nonhkip) name marker when no IP is reported', () => {
    expect(
      isNonHkExit({ ipExport: '', name: 'Indonesia 1GB 7Days (nonhkip)' }),
    ).toBe(true);
    expect(isNonHkExit({ ipExport: null, name: 'China 1GB 7Days' })).toBe(
      false,
    );
  });
});
