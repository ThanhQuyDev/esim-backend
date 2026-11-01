import { checkoutLocaleOf, isPaymentUsdIssue } from './payment-usd';

/**
 * doitac-3010 #043 — an English checkout reads prices in $ but pays in VND;
 * one that never got paid carries "payment $" for the admin to count.
 */
describe('"payment $" orders (doitac-3010 #043)', () => {
  it('should store the checkout language as vi or en', () => {
    expect(checkoutLocaleOf('en')).toBe('en');
    expect(checkoutLocaleOf('en-US')).toBe('en');
    expect(checkoutLocaleOf('vi')).toBe('vi');
    expect(checkoutLocaleOf(undefined)).toBeNull();
    expect(checkoutLocaleOf('')).toBeNull();
  });

  it('should mark an English checkout that is pending or failed', () => {
    expect(isPaymentUsdIssue({ checkoutLocale: 'en', status: 'pending' })).toBe(
      true,
    );
    expect(isPaymentUsdIssue({ checkoutLocale: 'en', status: 'failed' })).toBe(
      true,
    );
  });

  it('should not mark a paid one, a Vietnamese one or an old one', () => {
    expect(isPaymentUsdIssue({ checkoutLocale: 'en', status: 'paid' })).toBe(
      false,
    );
    expect(isPaymentUsdIssue({ checkoutLocale: 'vi', status: 'failed' })).toBe(
      false,
    );
    expect(isPaymentUsdIssue({ checkoutLocale: null, status: 'failed' })).toBe(
      false,
    );
  });
});
