import { OrdersService } from './orders.service';

/**
 * doitac-3010 #005 — "Gửi lại email eSIM" leaves out the eSIMs that were
 * refunded, on a partner's order and on a web customer's alike: an order of
 * 7 eSIMs with 3 refunded re-sends 4 QR codes, not 7.
 */
describe('Resending eSIM emails skips refunded eSIMs (doitac-3010 #005)', () => {
  function makeService(
    items: { id: number; status?: string }[],
    esims: { id: number; orderItemId: number; status: string }[],
  ) {
    const sendEsimPurchase = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      logger: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
      orderRepository: {
        findById: jest
          .fn()
          .mockResolvedValue({ id: 1, userId: 9, orderNumber: 'ORD-1' }),
      },
      usersService: {
        findById: jest.fn().mockResolvedValue({ email: 'khach@example.com' }),
      },
      orderItemsService: {
        findByOrderId: jest
          .fn()
          .mockResolvedValue(items.map((i) => ({ planId: 3, ...i }))),
      },
      esimsService: {
        findByOrderItemIds: jest
          .fn()
          .mockResolvedValue(
            esims.map((e) => ({ planId: 3, iccid: `89${e.id}`, ...e })),
          ),
      },
      plansService: { findById: jest.fn().mockResolvedValue({ id: 3 }) },
      mailService: { sendEsimPurchase },
    });
    return { service, sendEsimPurchase };
  }

  it('should mail only the eSIMs that were not refunded', async () => {
    const { service, sendEsimPurchase } = makeService(
      [{ id: 10 }],
      [
        { id: 1, orderItemId: 10, status: 'refunded' },
        { id: 2, orderItemId: 10, status: 'active' },
        { id: 3, orderItemId: 10, status: 'refunded' },
        { id: 4, orderItemId: 10, status: 'available' },
      ],
    );

    const result = await service.resendEsimEmail(1, { force: true });

    expect(result.sent).toBe(2);
    expect(
      sendEsimPurchase.mock.calls.map(([data]) => data.esimId).sort(),
    ).toEqual([2, 4]);
  });

  it('should leave out a whole line refunded at once', async () => {
    const { service, sendEsimPurchase } = makeService(
      [{ id: 10, status: 'refunded' }, { id: 11 }],
      [
        { id: 1, orderItemId: 10, status: 'available' },
        { id: 2, orderItemId: 11, status: 'available' },
      ],
    );

    await service.resendEsimEmail(1, { force: true });

    expect(sendEsimPurchase.mock.calls.map(([data]) => data.esimId)).toEqual([
      2,
    ]);
  });

  it('should say so when every eSIM was refunded', async () => {
    const { service, sendEsimPurchase } = makeService(
      [{ id: 10 }],
      [{ id: 1, orderItemId: 10, status: 'refunded' }],
    );

    const result = await service.resendEsimEmail(1, { force: true });

    expect(result).toEqual({ sent: 0, skippedReason: 'all-esims-refunded' });
    expect(sendEsimPurchase).not.toHaveBeenCalled();
  });
});
