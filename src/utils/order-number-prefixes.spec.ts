import { readFileSync } from 'fs';
import { join } from 'path';
import { generateOrderNumber } from './order-number';

/**
 * #051 (test round 4) — eSIM orders got the readable date-time code, but
 * topups, orders placed on a customer's behalf and partner-channel orders still
 * built their own `Date.now()` codes (`TOPUP-1791588400985-53RN3I`).
 */
describe('Order codes for every kind of order (#051)', () => {
  const at = new Date('2026-09-25T14:08:05.694Z'); // 21:08:05.694 in Vietnam

  it.each(['ORD-', 'TOPUP-', 'MAN-', 'PTN-', 'VORD-'])(
    'should give %s the date-time code',
    (prefix) => {
      expect(generateOrderNumber(prefix, at)).toMatch(
        new RegExp(`^${prefix}260925210805694-[A-Z0-9]{6}$`),
      );
    },
  );

  it('should leave no order code built from Date.now()', () => {
    const files = [
      'orders/orders.service.ts',
      'topup/topup.service.ts',
      'payment/payment.service.ts',
      'custom-payment-links/custom-payment-links.service.ts',
    ];
    for (const file of files) {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      expect({
        file,
        legacy: /\$\{Date\.now\(\)\}-/.test(source),
      }).toEqual({ file, legacy: false });
    }
  });
});
