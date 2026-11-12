import { webhookMayUpdateEsim } from './webhook-esim-guard';

/** SECURITY 12/11/2026 — a forged webhook taking a customer's eSIM. */
describe('webhookMayUpdateEsim', () => {
  it("should let a supplier's retry update the eSIM of the same order item", () => {
    expect(
      webhookMayUpdateEsim({ orderItemId: 7, userId: 3 }, [7, 8], 'airalo'),
    ).toBe(true);
  });

  it("should refuse an eSIM that belongs to another customer's order", () => {
    expect(
      webhookMayUpdateEsim({ orderItemId: 99, userId: 3 }, [7], 'airalo'),
    ).toBe(false);
  });

  it('should refuse unowned stock of another supplier', () => {
    expect(
      webhookMayUpdateEsim(
        { orderItemId: null, userId: null, provider: 'esimvn' },
        [7],
        'gadgetkorea',
      ),
    ).toBe(false);
  });

  it('should refuse an eSIM with an owner but no order item', () => {
    expect(
      webhookMayUpdateEsim(
        { orderItemId: null, userId: 5, provider: 'billion' },
        [7],
        'billion',
      ),
    ).toBe(false);
  });

  it('should allow an unowned row of the same supplier', () => {
    expect(
      webhookMayUpdateEsim(
        { orderItemId: null, userId: null, provider: 'billion' },
        [7],
        'billion',
      ),
    ).toBe(true);
  });
});
