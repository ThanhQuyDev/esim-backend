import { OrdersService } from './orders.service';

/**
 * vande #026 — refunding one of two Viettel eSIMs made it vanish from the
 * order (and from the refund picker), unlike every other supplier's eSIM,
 * which stays listed, greyed out.
 */
describe('Refunding an eSIM we stock ourselves (vande #026)', () => {
  it('should mark it refunded and leave it on its order line', async () => {
    const update = jest.fn().mockResolvedValue(null);
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      esimsService: { update },
      plansService: {
        findById: jest
          .fn()
          .mockResolvedValue({ provider: 'viettel', isLocalInventory: true }),
      },
      logger: { error: jest.fn() },
    });

    const warnings = await (
      service as unknown as {
        cancelEsimsWithSuppliers: (
          esims: unknown[],
          items: unknown[],
        ) => Promise<string[]>;
      }
    ).cancelEsimsWithSuppliers(
      [{ id: 81, iccid: '8984', orderItemId: 25 }],
      [{ id: 25, planId: 7 }],
    );

    expect(warnings).toEqual([]);
    expect(update).toHaveBeenCalledWith(81, { status: 'refunded' });
  });
});
