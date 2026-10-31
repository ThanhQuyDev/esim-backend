import { OrdersService } from './orders.service';

/**
 * doitac-3010 #003 — an order an admin places for a customer is a direct sale.
 *
 * Attribution is looked up by the buyer's account too, so typing the email of
 * a customer who once clicked a partner's link gave the order that partner and
 * its rate. "Đặt đơn hộ khách" now never asks.
 */
describe('Đặt đơn hộ khách earns no partner commission (doitac-3010 #003)', () => {
  const STOP = new Error('stop after attribution');

  function makeService() {
    const service = Object.create(OrdersService.prototype) as OrdersService;
    const internals = service as unknown as Record<string, jest.Mock | object>;
    const resolvePartnerAttribution = jest.fn().mockResolvedValue({
      partnerLinkCode: 'CUCDULICH',
      attributedPartnerId: 1,
      linkId: 1,
    });
    // The attribution is the first thing handed to the fraud check; stop the
    // order there, the rest is not what this test is about.
    const resolveFraudSignals = jest.fn().mockRejectedValue(STOP);
    Object.assign(internals, {
      usersService: { update: jest.fn() },
      plansService: {
        findForSale: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
      },
      calculateOrderPricing: jest.fn().mockResolvedValue({ couponCode: null }),
      resolvePartnerAttribution,
      resolveFraudSignals,
    });
    return { service, resolvePartnerAttribution, resolveFraudSignals };
  }

  const items = [{ planId: 3, quantity: 1 }];

  it('should give a manual order no partner, whoever the buyer is', async () => {
    const { service, resolvePartnerAttribution, resolveFraudSignals } =
      makeService();

    await expect(
      service.createPendingOrder(
        42,
        { currency: 'USD', items, paymentMethod: 'admin_manual' } as never,
        'MAN-1',
        25000,
      ),
    ).rejects.toBe(STOP);

    expect(resolvePartnerAttribution).not.toHaveBeenCalled();
    expect(resolveFraudSignals.mock.calls[0][0]).toBeNull();
  });

  it('should still credit the partner on a customer’s own checkout', async () => {
    const { service, resolvePartnerAttribution, resolveFraudSignals } =
      makeService();

    await expect(
      service.createPendingOrder(
        42,
        { currency: 'USD', items, paymentMethod: 'sepay' } as never,
        'ORD-1',
        25000,
      ),
    ).rejects.toBe(STOP);

    expect(resolvePartnerAttribution).toHaveBeenCalled();
    expect(resolveFraudSignals.mock.calls[0][0]).toBe(1);
  });
});
