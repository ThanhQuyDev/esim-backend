import { SAFE_TARGET_PATH } from './dto/partner-link.dto';

/** SECURITY 12/11/2026 — esim.vn/go/<code> as an open redirect. */
describe('SAFE_TARGET_PATH', () => {
  it.each(['', '/', '/esim-nhat-ban', '/esim-nhat-ban?utm_source=fb&subid=a'])(
    'should accept %j',
    (path) => expect(SAFE_TARGET_PATH.test(path)).toBe(true),
  );

  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'evil.com',
    '/a b',
    '/a\\b',
    'javascript:alert(1)',
  ])('should refuse %j', (path) =>
    expect(SAFE_TARGET_PATH.test(path)).toBe(false),
  );
});
