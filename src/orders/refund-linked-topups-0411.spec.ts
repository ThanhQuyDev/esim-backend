import { OrdersService } from './orders.service';

/**
 * vande-0411 #008 — refunding an eSIM refunds what was bought on top of it, and
 * nothing else. Shapes follow TOPUP-261031165655072-J1Y45I on the copy of prod.
 */
const ORDER = {
  id: 7,
  orderNumber: 'ORD-1',
  status: 'paid',
  orderType: 'ESIM',
};
const TOPUP = {
  id: 70,
  orderNumber: 'TOPUP-1',
  status: 'completed',
  orderType: 'TOPUP',
  payableVndPrice: 0,
  walletSpentVndAmount: 138_000,
  refundedAmountVnd: 0,
  paymentMethod: 'exu_wallet',
  topupProvider: 'ESIM_ACCESS',
};
const ESIMS = [
  { id: 1, orderItemId: 11, iccid: 'A' },
  { id: 2, orderItemId: 12, iccid: 'B' },
];

function build(topup: Record<string, unknown> = TOPUP) {
  const refundOrder = jest.fn().mockResolvedValue({ id: 1 });
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    walletsService: { refundOrder },
    orderRepository: {
      findById: jest.fn(() => Promise.resolve(topup)),
    },
    orderItemsService: {
      findByOrderId: jest.fn(() => Promise.resolve([{ id: 11 }, { id: 12 }])),
    },
    esimsService: {
      findByOrderItemIds: jest.fn((ids: number[]) =>
        Promise.resolve(ESIMS.filter((e) => ids.includes(e.orderItemId))),
      ),
      findTopupsByIccid: jest.fn((iccid: string) =>
        Promise.resolve(iccid === 'A' ? [{ orderId: 70 }] : []),
      ),
    },
    partnersService: {
      reverseCommissionForOrder: jest.fn(),
      refundPartnerTopupsOfIccids: jest.fn().mockResolvedValue({
        refunded: [{ orderNumber: 'TOPUP-70', amountVnd: 138_000, iccid: 'A' }],
        warnings: [],
      }),
    },
    logger: { log: jest.fn(), error: jest.fn() },
  });
  const run = (ctx: Record<string, unknown>, order: unknown = ORDER) =>
    (
      service as never as {
        refundLinkedTopups(
          o: unknown,
          d: unknown,
          a: number,
          c: unknown,
        ): Promise<{ requests: string[]; warnings: string[] }>;
      }
    ).refundLinkedTopups(order, { mode: 'wallet', reason: 'r' }, 1, {
      isPartial: false,
      selectedItemIds: [],
      selectedEsims: [],
      orderItems: [],
      ...ctx,
    });
  return { refundOrder, run, service };
}

describe('Hoàn kèm đơn mua thêm của eSIM (vande-0411 #008)', () => {
  it('should refund the topup of a refunded eSIM in full', async () => {
    const { refundOrder, run } = build();

    const result = await run({});

    expect(refundOrder).toHaveBeenCalledTimes(1);
    expect(refundOrder.mock.calls[0][0]).toMatchObject({
      id: 70,
      status: 'paid',
    });
    expect(refundOrder.mock.calls[0][1]).toMatchObject({
      mode: 'wallet',
      amountVnd: 138_000,
    });
    expect(result.requests[0]).toContain('TOPUP-1');
    expect(result.warnings).toEqual([]);
  });

  it('should leave the topup alone when another eSIM is the one refunded', async () => {
    const { refundOrder, run } = build();

    await run({ isPartial: true, selectedEsims: [ESIMS[1]] });

    expect(refundOrder).not.toHaveBeenCalled();
  });

  it('should follow a single eSIM that was picked', async () => {
    const { refundOrder, run } = build();

    await run({ isPartial: true, selectedEsims: [ESIMS[0]] });

    expect(refundOrder).toHaveBeenCalledTimes(1);
  });

  it('should only give back what is left of the topup', async () => {
    const { refundOrder, run } = build({
      ...TOPUP,
      refundedAmountVnd: 38_000,
    });

    await run({});

    expect(refundOrder.mock.calls[0][1].amountVnd).toBe(100_000);
  });

  it('should not refund twice', async () => {
    const { refundOrder, run } = build({
      ...TOPUP,
      refundedAmountVnd: 138_000,
    });

    await run({});

    expect(refundOrder).not.toHaveBeenCalled();
  });

  // doitac-0911 #002: no longer left to the admin.
  it("should refund a partner's topup into the deposit wallet", async () => {
    const { refundOrder, run, service } = build({
      ...TOPUP,
      paymentMethod: 'partner_wallet',
    });

    const result = await run({});

    expect(refundOrder).not.toHaveBeenCalled();
    expect(
      (
        service as never as {
          partnersService: { refundPartnerTopupsOfIccids: jest.Mock };
        }
      ).partnersService.refundPartnerTopupsOfIccids,
    ).toHaveBeenCalledWith(['A'], expect.objectContaining({ adminId: 1 }));
    expect(result.requests[0]).toContain('vào ví ký quỹ');
  });

  it("should leave a partner's topup already refunded alone", async () => {
    const { run, service } = build({
      ...TOPUP,
      paymentMethod: 'partner_wallet',
      status: 'refunded',
    });

    await run({});

    expect(
      (
        service as never as {
          partnersService: { refundPartnerTopupsOfIccids: jest.Mock };
        }
      ).partnersService.refundPartnerTopupsOfIccids,
    ).not.toHaveBeenCalled();
  });

  it('should ask the admin to check a supplier not known to cancel it', async () => {
    const { run } = build({ ...TOPUP, topupProvider: 'AIRALO' });

    const result = await run({});

    expect(result.warnings[0]).toContain('AIRALO');
  });

  it('should keep going and tell the admin when one refund fails', async () => {
    const { refundOrder, run } = build();
    refundOrder.mockRejectedValueOnce(new Error('boom'));

    const result = await run({});

    expect(result.warnings[0]).toContain('TOPUP-1');
  });

  it('should not chase topups when a topup order itself is refunded', async () => {
    const { refundOrder, run } = build();

    await run({}, { ...ORDER, orderType: 'TOPUP' });

    expect(refundOrder).not.toHaveBeenCalled();
  });
});
