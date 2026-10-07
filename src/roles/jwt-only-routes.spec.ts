import { readFileSync } from 'fs';
import { globSync } from 'glob';
import { join, relative } from 'path';

/**
 * #011 — a route guarded by `AuthGuard('jwt')` alone accepts *any* signed-in
 * account: a customer who registered on the storefront, an author, a partner.
 * Every CMS write used to be guarded that way, so anyone could edit the site
 * scripts, banners, FAQs or confirm a custom payment link.
 *
 * This list is every route that is meant to be open to any signed-in account.
 * A new JWT-only route fails this test until it is either given `@Roles(...)`
 * with `RolesGuard`, or deliberately added here.
 */
const ALLOWED_JWT_ONLY = [
  'auth/auth.controller.ts#POST refresh',
  'auth/auth.controller.ts#PATCH me',
  'auth/auth.controller.ts#PATCH me/profile',
  'auth/auth.controller.ts#POST me/password',
  'auth/auth.controller.ts#DELETE me',
  'coupons/coupons.controller.ts#GET code/:code',
  'coupons/coupons.controller.ts#POST validate',
  'email-change/email-change.controller.ts#<class>',
  'files/infrastructure/uploader/local/files.controller.ts#POST upload',
  'files/infrastructure/uploader/s3-presigned/files.controller.ts#POST upload',
  'files/infrastructure/uploader/s3/files.controller.ts#POST upload',
  'partners/partners.controller.ts#POST links/:code/bind',
  'payment/payment.controller.ts#POST plan/checkout',
  'payment/payment.controller.ts#POST plan/bank-transfer',
  'tickets/tickets.controller.ts#GET mine',
  'tickets/tickets.controller.ts#GET :id/messages',
  'tickets/tickets.controller.ts#POST :id/messages',
  'topup/topup.controller.ts#<class>',
].sort();

function jwtOnlyRoutes(): string[] {
  const src = join(__dirname, '..');
  const found: string[] = [];
  for (const file of globSync('**/*.controller.ts', { cwd: src })) {
    const lines = readFileSync(join(src, file), 'utf8').split('\n');
    const rel = relative('.', file).replace(/\\/g, '/');
    lines.forEach((line, i) => {
      if (!/@UseGuards\(\s*AuthGuard\('jwt'\)\s*\)/.test(line)) return;
      for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
        if (/^\s*export class/.test(lines[j])) {
          found.push(`${rel}#<class>`);
          return;
        }
        const verb = /@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?/.exec(
          lines[j],
        );
        if (verb) {
          found.push(`${rel}#${verb[1].toUpperCase()} ${verb[2] ?? ''}`.trim());
          return;
        }
      }
    });
  }
  return found.sort();
}

describe('JWT-only routes (#011)', () => {
  it('should only let customer-facing routes skip the role check', () => {
    expect(jwtOnlyRoutes()).toEqual(ALLOWED_JWT_ONLY);
  });
});
