import { PartnerPurchaseService } from './partner-purchase.service';
import { PartnersService } from '../partners/partners.service';

/**
 * The partner's cart, paid in one order (doitac-1410 #035).
 */
const QUOTE = {
  lines: [
    {
      planId: 1,
      name: 'Nhật 5GB',
      quantity: 2,
      unitPriceVnd: 100000,
      totalVnd: 200000,
      listTotalVnd: 300000,
      rejection: null,
    },
    {
      planId: 2,
      name: 'Thái 3GB',
      quantity: 1,
      unitPriceVnd: 50000,
      totalVnd: 50000,
      listTotalVnd: 80000,
      rejection: null,
    },
  ],
  planCount: 2,
  esimCount: 3,
  totalVnd: 250000,
  listTotalVnd: 380000,
  balanceVnd: 1000000,
  rejection: null,
};

function build(items: unknown[]) {
  const debit = jest.fn().mockResolvedValue(undefined);
  const refund = jest.fn().mockResolvedValue(undefined);
  const submit = jest.fn(async (input: any) => {
    await input.onDebit(77, 'PTN-CART');
    return { id: 77, orderNumber: 'PTN-CART', status: 'paid' };
  });
  const query = jest.fn().mockResolvedValue(items);
  const service = Object.create(
    PartnerPurchaseService.prototype,
  ) as PartnerPurchaseService;
  Object.assign(service, {
    logger: { error: jest.fn(), log: jest.fn(), warn: jest.fn() },
    partnersService: {
      getPartnerOrThrowById: jest
        .fn()
        .mockResolvedValue({ id: 8, userId: 100 }),
      quoteCart: jest.fn().mockResolvedValue(QUOTE),
      debitWalletForPurchase: debit,
      refundWalletForPurchase: refund,
    },
    ordersService: { submitPartnerPurchase: submit },
    dataSource: { query },
  });
  return { service, debit, refund, submit, query };
}

describe('PartnerPurchaseService.purchaseCart (doitac-1410 #035)', () => {
  it('should put every line in one order and debit the cart total once', async () => {
    const { service, debit, refund, submit } = build([
      { id: 1, planId: 1, quantity: 2, orderRequestId: 'A', n: 0 },
      { id: 2, planId: 2, quantity: 1, orderRequestId: null, n: 1 },
    ]);

    const result = await service.purchaseCart(8, {
      items: [
        { planId: 1, quantity: 2 },
        { planId: 2, quantity: 1 },
      ],
      recipientEmail: ' Khach@Example.com ',
    });

    expect(submit.mock.calls[0][0].items).toEqual([
      { planId: 1, quantity: 2, unitPriceVnd: 100000 },
      { planId: 2, quantity: 1, unitPriceVnd: 50000 },
    ]);
    expect(submit.mock.calls[0][0].deliveryEmail).toBe('khach@example.com');
    expect(debit).toHaveBeenCalledTimes(1);
    expect(debit.mock.calls[0][1].amountVnd).toBe(250000);
    expect(refund).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      planCount: 2,
      quantity: 3,
      totalVnd: 250000,
      refundedVnd: 0,
    });
  });

  // doitac-0911 #001: a line the supplier turned down is left for the
  // retry, never refunded at checkout — refunding it and then delivering it
  // on a retry gave PTN-261104004736115-O6YPBE the eSIM and the money both.
  it('should keep a line the supplier turned down paid, for the retry', async () => {
    const { service, refund, query } = build([
      { id: 1, planId: 1, quantity: 2, orderRequestId: null, n: 0 },
      { id: 2, planId: 2, quantity: 1, orderRequestId: null, n: 1 },
    ]);

    const result = await service.purchaseCart(8, {
      items: [{ planId: 1, quantity: 2 }],
    });

    expect(refund).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]: [string]) => /status = 'failed'/.test(sql)),
    ).toBe(false);
    expect(result).toMatchObject({
      refundedVnd: 0,
      totalVnd: 250000,
      notReceivedEsims: 2,
      esimCount: 1,
      pendingEsims: 0,
    });
  });

  it('should not refund even when no line was taken', async () => {
    const { service, refund, query } = build([
      { id: 1, planId: 1, quantity: 2, orderRequestId: null, n: 0 },
      { id: 2, planId: 2, quantity: 1, orderRequestId: null, n: 0 },
    ]);

    const result = await service.purchaseCart(8, {
      items: [{ planId: 1, quantity: 2 }],
    });

    expect(refund).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]: [string]) => /status = 'failed'/.test(sql)),
    ).toBe(false);
    expect(result.notReceivedEsims).toBe(3);
  });
});

describe('PartnersService.quoteCart (doitac-1410 #035)', () => {
  function svc(balance: number) {
    const s = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(s, {
      quotePurchase: jest.fn((_p: number, planId: number, quantity: number) =>
        Promise.resolve({
          quantity,
          unitPriceVnd: planId * 100000,
          totalVnd: planId * 100000 * quantity,
          listUnitPriceVnd: 0,
          listTotalVnd: 0,
          marginVnd: 0,
          marginPercent: 0,
          rejection: null,
        }),
      ),
      dataSource: { query: jest.fn().mockResolvedValue([{ name: 'Gói' }]) },
      getOrCreateWallet: jest.fn().mockResolvedValue({ balanceVnd: balance }),
      // A deposit, not credit (vande #056).
      partnerRepository: { findOne: jest.fn().mockResolvedValue(null) },
    });
    return s;
  }

  it('should merge a plan added twice and total the cart', async () => {
    const quote = await svc(1000000).quoteCart(8, [
      { planId: 1, quantity: 1 },
      { planId: 1, quantity: 2 },
      { planId: 2, quantity: 1 },
    ]);
    expect(quote.planCount).toBe(2);
    expect(quote.esimCount).toBe(4);
    expect(quote.totalVnd).toBe(500000);
    expect(quote.rejection).toBeNull();
  });

  it('should judge the balance on the whole cart', async () => {
    const quote = await svc(400000).quoteCart(8, [
      { planId: 2, quantity: 1 },
      { planId: 1, quantity: 3 },
    ]);
    expect(quote.rejection).toContain('Số dư ví không đủ');
  });
});
