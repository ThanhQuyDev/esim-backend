import { checkoutDeliveryEmail } from './orders.service';

/**
 * "Email" at checkout is where the eSIM goes (doitac-1410 #066): it is stored
 * on the order as `deliveryEmail`, which the eSIM mail sends to instead of the
 * signed-in account's address.
 */
describe('checkoutDeliveryEmail (doitac-1410 #066)', () => {
  it('should keep the address the buyer typed, cleaned up', () => {
    expect(checkoutDeliveryEmail('  Nhan.ESIM@Example.com ')).toBe(
      'nhan.esim@example.com',
    );
  });

  it('should fall back to the account address when none or a bad one is given', () => {
    expect(checkoutDeliveryEmail(undefined)).toBeNull();
    expect(checkoutDeliveryEmail('')).toBeNull();
    expect(checkoutDeliveryEmail('not-an-email')).toBeNull();
  });
});
