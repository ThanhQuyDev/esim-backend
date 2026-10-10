import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PartnersController } from './partners.controller';

/**
 * #054 (test round 4) — the portal's "Tắt / Mở" link button always failed with
 * "Internal server error": `PATCH me/links/:id` had no guards, so `req.user`
 * was undefined. Every `me/*` route reads the signed-in partner from
 * `req.user`, so each must be behind the JWT guard.
 */
describe('Partner portal routes are guarded (#054)', () => {
  const proto = PartnersController.prototype as unknown as Record<
    string,
    unknown
  >;
  const meRoutes = Object.getOwnPropertyNames(proto).filter((name) => {
    const handler = proto[name];
    if (typeof handler !== 'function' || name === 'constructor') return false;
    const path = Reflect.getMetadata(PATH_METADATA, handler) as
      | string
      | undefined;
    return typeof path === 'string' && path.startsWith('me/');
  });

  it('should find the portal routes', () => {
    expect(meRoutes).toContain('updateLink');
    expect(meRoutes.length).toBeGreaterThan(5);
  });

  it.each(meRoutes)('should guard %s', (name) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      proto[name] as object,
    ) as unknown[] | undefined;
    expect(guards?.length ?? 0).toBeGreaterThan(0);
  });
});
