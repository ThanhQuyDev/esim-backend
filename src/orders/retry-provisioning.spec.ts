import { OrdersService } from './orders.service';

/**
 * "Gọi lại API lấy eSIM" (#030) — used when the deposit with a supplier ran
 * dry mid-order and only some lines came back with an eSIM.
 *
 * The danger is the opposite of the feature: `submitProviders` buys an eSIM for
 * every line it is handed, so a careless retry would pay for a SECOND eSIM on
 * every line that already worked. These tests pin exactly which lines are
 * re-sent.
 */
function makeService(opts: {
  orderStatus?: string;
  items: { id: number; orderRequestId?: string | null }[];
  esims: { orderItemId: number }[];
  /** eSIMs mailed by the auto-resend after a successful re-order (#014). */
  emailsSent?: number;
}) {
  const submitted: { orderId: number; onlyItemIds?: number[] }[] = [];
  const mutedFlags: (boolean | undefined)[] = [];
  const mailed: { orderId: number; onlyOrderItemIds?: number[] }[] = [];

  const orderRepository = {
    findById: jest.fn().mockResolvedValue({
      id: 5,
      orderNumber: 'ORD-5',
      status: opts.orderStatus ?? 'paid',
    }),
  };
  const orderItemsService = {
    findByOrderId: jest.fn().mockResolvedValue(opts.items),
  };
  const esimsService = {
    findByOrderItemIds: jest
      .fn()
      .mockImplementation((ids: number[]) =>
        Promise.resolve(
          opts.esims.filter((esim) => ids.includes(esim.orderItemId)),
        ),
      ),
  };

  const service = Object.create(OrdersService.prototype) as OrdersService;
  const internals = service as unknown as Record<string, unknown>;
  internals.orderRepository = orderRepository;
  internals.orderItemsService = orderItemsService;
  internals.esimsService = esimsService;
  internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  internals.submitProviders = jest.fn(
    (
      orderId: number,
      options?: { onlyItemIds?: number[]; mutedEmail?: boolean },
    ) => {
      submitted.push({ orderId, onlyItemIds: options?.onlyItemIds });
      mutedFlags.push(options?.mutedEmail);
      return Promise.resolve();
    },
  );
  internals.resendEsimEmail = jest.fn(
    (orderId: number, options?: { onlyOrderItemIds?: number[] }) => {
      mailed.push({ orderId, onlyOrderItemIds: options?.onlyOrderItemIds });
      return Promise.resolve({ sent: opts.emailsSent ?? 0 });
    },
  );

  return { service, submitted, mailed, mutedFlags };
}

describe('Retry provisioning for an order', () => {
  it('should re-send only the line that never got an eSIM', async () => {
    const { service, submitted } = makeService({
      items: [
        { id: 1, orderRequestId: 'REF-1' }, // delivered
        { id: 2, orderRequestId: null }, // supplier refused — retry this one
      ],
      esims: [{ orderItemId: 1 }],
    });

    const result = await service.retryProvisioning(5);

    expect(result.retriedItemIds).toEqual([2]);
    expect(result.skippedItemIds).toEqual([1]);
    expect(submitted).toEqual([{ orderId: 5, onlyItemIds: [2] }]);
  });

  it('should never re-order a line that already has an eSIM', async () => {
    const { service, submitted } = makeService({
      items: [{ id: 1, orderRequestId: null }],
      // No provider reference, but the eSIM did arrive — buying another one
      // would cost real money and hand the customer a duplicate.
      esims: [{ orderItemId: 1 }],
    });

    const result = await service.retryProvisioning(5);

    expect(result.retriedItemIds).toEqual([]);
    expect(submitted).toHaveLength(0);
  });

  it('should leave a line the supplier already accepted alone', async () => {
    const { service, submitted } = makeService({
      // Airalo / Billion / MicroEsim deliver by webhook: accepted, eSIM still
      // on its way. Re-sending would place a second order.
      items: [{ id: 1, orderRequestId: 'REF-1' }],
      esims: [],
    });

    const result = await service.retryProvisioning(5);

    expect(result.retriedItemIds).toEqual([]);
    expect(submitted).toHaveLength(0);
  });

  it('should say plainly when there is nothing to retry', async () => {
    const { service } = makeService({
      items: [{ id: 1, orderRequestId: 'REF-1' }],
      esims: [{ orderItemId: 1 }],
    });

    const result = await service.retryProvisioning(5);

    expect(result.message).toMatch(/Không có sản phẩm nào cần gọi lại/);
  });

  it('should refuse an order that has not been paid', async () => {
    const { service } = makeService({
      orderStatus: 'pending',
      items: [{ id: 1, orderRequestId: null }],
      esims: [],
    });

    await expect(service.retryProvisioning(5)).rejects.toThrow(
      /only a paid order/i,
    );
  });

  // #014 — the picker: an order with several eSIMs is retried line by line.
  describe('choosing which lines to retry (#014)', () => {
    it('should re-sends only the chosen line', async () => {
      const { service, submitted } = makeService({
        items: [
          { id: 1, orderRequestId: null },
          { id: 2, orderRequestId: null },
          { id: 3, orderRequestId: null },
        ],
        esims: [],
      });

      const result = await service.retryProvisioning(5, { itemIds: [2] });

      expect(result.retriedItemIds).toEqual([2]);
      expect(submitted).toEqual([{ orderId: 5, onlyItemIds: [2] }]);
    });

    it('should still refuses a chosen line that already has an eSIM', async () => {
      const { service, submitted } = makeService({
        items: [
          { id: 1, orderRequestId: null },
          { id: 2, orderRequestId: null },
        ],
        // The admin ticked #1 by mistake; it already holds an eSIM, and buying a
        // second one costs real money.
        esims: [{ orderItemId: 1 }],
      });

      const result = await service.retryProvisioning(5, { itemIds: [1, 2] });

      expect(result.retriedItemIds).toEqual([2]);
      expect(result.skippedItemIds).toEqual([1]);
      expect(submitted).toEqual([{ orderId: 5, onlyItemIds: [2] }]);
    });

    it('should rejects an item id that is not on this order', async () => {
      const { service, submitted } = makeService({
        items: [{ id: 1, orderRequestId: null }],
        esims: [],
      });

      await expect(
        service.retryProvisioning(5, { itemIds: [99] }),
      ).rejects.toThrow(/no item/i);
      expect(submitted).toHaveLength(0);
    });

    it('should with no selection behaves as before, retrying every eligible line', async () => {
      const { service, submitted } = makeService({
        items: [
          { id: 1, orderRequestId: 'REF-1' },
          { id: 2, orderRequestId: null },
          { id: 3, orderRequestId: null },
        ],
        esims: [],
      });

      const result = await service.retryProvisioning(5);

      expect(result.retriedItemIds).toEqual([2, 3]);
      expect(submitted).toEqual([{ orderId: 5, onlyItemIds: [2, 3] }]);
    });
  });

  // #014 — "gọi lại thành công thì tự động gửi lại email esim cho khách".
  describe('auto-resending the eSIM email (#014)', () => {
    it('should mail each eSIM once: the re-order itself is muted (#020)', async () => {
      // Local stock (Viettel) is mailed by submitProviders on assignment; the
      // retry mails again below, so the re-order must not.
      const { service, submitted, mailed, mutedFlags } = makeService({
        items: [{ id: 2, orderRequestId: null }],
        esims: [],
        emailsSent: 2,
      });

      await service.retryProvisioning(5);

      expect(submitted).toHaveLength(1);
      expect(mutedFlags).toEqual([true]);
      expect(mailed).toHaveLength(1);
    });

    it('should mails only the lines it just re-ordered', async () => {
      const { service, mailed } = makeService({
        items: [
          { id: 1, orderRequestId: 'REF-1' }, // delivered long ago
          { id: 2, orderRequestId: null },
        ],
        esims: [{ orderItemId: 1 }],
        emailsSent: 1,
      });

      const result = await service.retryProvisioning(5);

      // Mailing the whole order would send a second copy of eSIM #1.
      expect(mailed).toEqual([{ orderId: 5, onlyOrderItemIds: [2] }]);
      expect(result.emailsSent).toBe(1);
      expect(result.message).toMatch(/Đã gửi lại email eSIM/);
    });

    it('should does not mail when there was nothing to re-order', async () => {
      const { service, mailed } = makeService({
        items: [{ id: 1, orderRequestId: 'REF-1' }],
        esims: [{ orderItemId: 1 }],
      });

      const result = await service.retryProvisioning(5);

      expect(mailed).toHaveLength(0);
      expect(result.emailsSent).toBe(0);
    });

    it('should reports an asynchronous supplier as normal, not as a failure', async () => {
      const { service } = makeService({
        items: [{ id: 1, orderRequestId: null }],
        esims: [],
        emailsSent: 0,
      });

      const result = await service.retryProvisioning(5);

      expect(result.retriedItemIds).toEqual([1]);
      expect(result.message).toMatch(/email sẽ tự gửi khi eSIM về/);
    });

    it('should keeps the re-order a success when the email itself throws', async () => {
      const { service } = makeService({
        items: [{ id: 1, orderRequestId: null }],
        esims: [],
      });
      (service as unknown as { resendEsimEmail: jest.Mock }).resendEsimEmail =
        jest.fn().mockRejectedValue(new Error('SMTP down'));

      const result = await service.retryProvisioning(5);

      expect(result.retriedItemIds).toEqual([1]);
      expect(result.emailsSent).toBe(0);
    });
  });
});
