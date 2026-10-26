import { BillionService } from './billion.service';
import {
  billionPlanVariants,
  encodeBillionPlanId,
  parseBillionPlanId,
} from './billion-catalogue';
import {
  afterSaleFromF020,
  afterSaleFromN004,
  afterSaleFromN005,
  afterSaleNote,
} from './billion-after-sale';
import { OrdersService } from '../../orders/orders.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

/**
 * vande #004 — Billion's rechargeable eSIMs and refunds of delivered eSIMs.
 * The samples are Billion's own (F002 / F003 / F060, 26/10/2026); its API is
 * mocked throughout, nothing is ordered or refunded for real.
 */

// "Global13-500MB/day-384kbps": type 110, a rechargeable eSIM of series 10 (S01).
const RECHARGEABLE = {
  skuId: '1785911500899973',
  name: 'Global13-500MB/day-384kbps',
  type: '110',
  days: '1',
  capacity: '-1',
  highFlowSize: '512000',
  limitFlowSpeed: '384',
  planType: '1',
  rechargeableProduct: '1',
  rechargeableProductSeriesId: '10',
};
const RECHARGEABLE_PRICE = {
  skuId: '1785911500899973',
  price: [
    { copies: '1', days: '1', settlementPrice: '10.0000', retailPrice: '17' },
    { copies: '2', days: '2', settlementPrice: '12.5000', retailPrice: '21' },
    { copies: '3', days: '3', settlementPrice: '15.0000', retailPrice: '25' },
  ],
};

describe('Billion rechargeable eSIM plans (vande #004)', () => {
  it('should sell each duration with the series carrier fee and a :r id', () => {
    const variants = billionPlanVariants(RECHARGEABLE, RECHARGEABLE_PRICE, 3);
    expect(
      variants.map((v) => [v.providerPlanId, v.durationDays, v.cost]),
    ).toEqual([
      ['1785911500899973:1:r', 1, 13],
      ['1785911500899973:2:r', 2, 15.5],
      ['1785911500899973:3:r', 3, 18],
    ]);
    expect(variants[0]).toMatchObject({
      type: 'daily',
      dataMb: 500,
      fupSpeed: '384kbps',
      name: 'Global13-500MB/day-384kbps - 1 day',
    });
  });

  it('should keep the plain topup offer when no carrier fee is given', () => {
    const [offer] = billionPlanVariants(RECHARGEABLE, RECHARGEABLE_PRICE);
    expect(offer.providerPlanId).toBe('1785911500899973');
    expect(offer.cost).toBe(10);
  });

  it('should read the rechargeable mark back from the plan id', () => {
    expect(parseBillionPlanId(encodeBillionPlanId('77', 1, true))).toEqual({
      skuId: '77',
      copies: 1,
      rechargeable: true,
    });
    expect(parseBillionPlanId('77:5')).toEqual({
      skuId: '77',
      copies: 5,
      rechargeable: false,
    });
    expect(parseBillionPlanId('77')).toEqual({
      skuId: '77',
      copies: 1,
      rechargeable: false,
    });
  });
});

function billionWith(invoke: jest.Mock) {
  const service = Object.create(BillionService.prototype) as BillionService;
  Object.assign(service, {
    invoke,
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
  });
  return service;
}

describe('BillionService F040 / F017 (vande #004)', () => {
  it('should flag a rechargeable eSIM on its F040 sub-order', async () => {
    const invoke = jest.fn().mockResolvedValue({ orderId: 'B1' });
    const service = billionWith(invoke);
    Object.assign(service, { tradeTime: () => '2026-10-26 12:00:00' });

    await service.submitOrder({
      channelOrderId: 'ORD-1-bl',
      email: 'api@esim.test',
      subOrderList: [
        {
          channelSubOrderId: 'ORD-1-bl-5',
          deviceSkuId: '1785911500899973',
          planSkuCopies: 3,
          number: 1,
          rechargeable: true,
        },
        {
          channelSubOrderId: 'ORD-1-bl-6',
          deviceSkuId: '900',
          number: 1,
        },
      ],
    });

    const [, body] = invoke.mock.calls[0];
    expect(body.subOrderList).toEqual([
      {
        channelSubOrderId: 'ORD-1-bl-5',
        deviceSkuId: '1785911500899973',
        planSkuCopies: '3',
        number: '1',
        rechargeableESIM: '1',
      },
      {
        channelSubOrderId: 'ORD-1-bl-6',
        deviceSkuId: '900',
        planSkuCopies: '1',
        number: '1',
      },
    ]);
  });

  it('should send the eSIM after-sale fields F017 asks for', async () => {
    const invoke = jest.fn().mockResolvedValue({ afterSaleId: '1517370598' });
    const id = await billionWith(invoke).requestAfterSale({
      channelOrderId: 'ORD-261019155027058-HC0S55-bl',
      channelSubOrderId: 'ORD-261019155027058-HC0S55-bl-42',
      iccids: ['89812003919133190234'],
      reason: '20',
      comment: 'Khach doi lich',
    });

    expect(id).toBe('1517370598');
    expect(invoke).toHaveBeenCalledWith('F017', {
      channelOrderId: 'ORD-261019155027058-HC0S55-bl',
      channelSubOrderId: 'ORD-261019155027058-HC0S55-bl-42',
      reason: '20',
      iccid: ['89812003919133190234'],
      unSubscribeFlow: '1',
      receivingState: '1',
      returnCardOrNot: '0',
      refundType: '0',
      comment: 'Khach doi lich',
    });
  });

  it('should give reason 29 only to an eSIM never downloaded', async () => {
    const history = (statuses: string[]) =>
      jest
        .fn()
        .mockResolvedValue(statuses.map((status) => ({ status, iccid: '1' })));
    expect(await billionWith(history(['0'])).afterSaleReason('1')).toBe('29');
    expect(await billionWith(history(['0', '1'])).afterSaleReason('1')).toBe(
      '20',
    );
    expect(
      await billionWith(
        jest.fn().mockRejectedValue(new Error('down')),
      ).afterSaleReason('1'),
    ).toBe('20');
  });
});

describe('Billion after-sale statuses (vande #004)', () => {
  it('should read N004, N005 and F020', () => {
    expect(afterSaleFromN004({ auditStatus: '1', auditOpinion: 'OK' })).toEqual(
      { status: 'approved', opinion: 'OK' },
    );
    expect(afterSaleFromN004({ auditStatus: '2' })).toEqual({
      status: 'rejected',
      opinion: null,
    });
    expect(afterSaleFromN005({ refundState: '1' })).toEqual({
      status: 'refunded',
      opinion: null,
    });
    expect(afterSaleFromN005({ refundState: '9' })).toBeNull();
    expect(afterSaleFromF020({ auditStatus: '0', refundStatus: '0' })).toEqual({
      status: 'pending',
      opinion: null,
    });
    expect(
      afterSaleFromF020({ auditStatus: '2', refundStatus: '0' }).status,
    ).toBe('approved');
    expect(
      afterSaleFromF020({ auditStatus: '3', auditOpinion: 'Used' }),
    ).toEqual({ status: 'rejected', opinion: 'Used' });
    expect(
      afterSaleFromF020({ auditStatus: '2', refundStatus: '1' }).status,
    ).toBe('refunded');
  });

  it('should tell the admin to chase Billion when it refuses', () => {
    expect(
      afterSaleNote('77', '8981', { status: 'rejected', opinion: 'Đã dùng' }),
    ).toBe(
      'Billion TỪ CHỐI yêu cầu hoàn tiền #77 (ICCID 8981): "Đã dùng" — cần liên hệ Billion để lấy lại tiền.',
    );
  });
});

describe('Order refund → Billion after-sale (vande #004)', () => {
  const ORDER = {
    id: 7,
    orderNumber: 'ORD-261019155027058-HC0S55',
    attributedPartnerId: null,
  };
  const ITEMS = [
    { id: 42, vndPrice: 300000, quantity: 2, planId: 1, orderRequestId: 'B9' },
    { id: 43, vndPrice: 50000, quantity: 1, planId: 2 },
  ];

  function makeOrders(opts: { esimsOf42?: unknown[] } = {}) {
    const esims = [
      ...(opts.esimsOf42 ?? [
        { id: 101, orderItemId: 42, iccid: '8901', status: 'sold' },
        { id: 102, orderItemId: 42, iccid: '8902', status: 'sold' },
      ]),
      {
        id: 104,
        orderItemId: 43,
        iccid: '8904',
        status: 'sold',
        esimTranNo: 'T4',
      },
    ] as { orderItemId: number }[];
    const notes: string[] = [];
    const sql: unknown[][] = [];
    const billionService = {
      afterSaleReason: jest.fn((iccid: string) =>
        Promise.resolve(iccid === '8901' ? '29' : '20'),
      ),
      requestAfterSale: jest
        .fn()
        .mockImplementation((p: { reason: string }) =>
          Promise.resolve(`AS${p.reason}`),
        ),
      cancelOrder: jest.fn().mockResolvedValue(undefined),
    };
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      orderRepository: { findById: jest.fn().mockResolvedValue(ORDER) },
      orderItemsService: {
        findByOrderId: jest.fn().mockResolvedValue(ITEMS),
        update: jest.fn().mockResolvedValue({}),
      },
      esimsService: {
        findByOrderItemIds: jest.fn((ids: number[]) =>
          Promise.resolve(esims.filter((e) => ids.includes(e.orderItemId))),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      plansService: {
        findById: jest.fn((id: number) =>
          Promise.resolve(
            id === 1
              ? { provider: 'billion', isLocalInventory: false }
              : { provider: 'esimaccess', isLocalInventory: false },
          ),
        ),
      },
      esimAccessService: { cancelEsim: jest.fn() },
      billionService,
      walletsService: { refundOrder: jest.fn().mockResolvedValue({ id: 1 }) },
      dataSource: {
        query: jest.fn((q: string, params: unknown[]) => {
          sql.push([q, params]);
          return Promise.resolve([]);
        }),
      },
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      markRefundedEsims: jest.fn().mockResolvedValue(0),
      addOrderNote: jest.fn((_id: number, body: string) => {
        notes.push(body);
        return Promise.resolve({});
      }),
    });
    return { service, notes, sql, billionService };
  }

  it('should ask Billion through F017, not F008, for delivered eSIMs', async () => {
    const { service, notes, sql, billionService } = makeOrders();

    const res = await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 100000, reason: 'Khach huy' } as never,
      1,
    );

    expect(billionService.cancelOrder).not.toHaveBeenCalled();
    // One request per reason: 8901 never downloaded (29), 8902 used (20).
    expect(billionService.requestAfterSale).toHaveBeenCalledTimes(2);
    expect(billionService.requestAfterSale).toHaveBeenCalledWith({
      channelOrderId: 'ORD-261019155027058-HC0S55-bl',
      channelSubOrderId: 'ORD-261019155027058-HC0S55-bl-42',
      iccids: ['8901'],
      reason: '29',
      comment: 'Khach huy',
    });
    expect(billionService.requestAfterSale).toHaveBeenCalledWith(
      expect.objectContaining({ iccids: ['8902'], reason: '20' }),
    );
    expect(res.supplierWarnings).toEqual([]);
    expect(res.supplierRequests).toEqual([
      expect.stringContaining('#AS29 cho ICCID 8901 (eSIM chưa tải về)'),
      expect.stringContaining('#AS20 cho ICCID 8902 (hoàn không lý do)'),
    ]);
    expect(notes).toHaveLength(2);
    const inserts = sql.filter(([q]) =>
      String(q).includes('INSERT INTO billion_after_sale'),
    );
    expect(inserts.map(([, p]) => p)).toEqual([
      ['AS29', 7, 42, '8901', '29'],
      ['AS20', 7, 42, '8902', '20'],
    ]);
  });

  it('should still cancel with F008 a line Billion has not delivered', async () => {
    const { service, billionService } = makeOrders({ esimsOf42: [] });

    await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 100000 } as never,
      1,
    );

    expect(billionService.cancelOrder).toHaveBeenCalledWith('B9');
    expect(billionService.requestAfterSale).not.toHaveBeenCalled();
  });

  it('should refund the customer even when Billion refuses the request', async () => {
    const { service, billionService } = makeOrders();
    billionService.requestAfterSale.mockRejectedValue(
      new Error('BILLION F017 error: 1001 - iccid error'),
    );

    const res = await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 100000 } as never,
      1,
    );

    expect(res.id).toBe(1);
    expect(res.supplierWarnings).toEqual([
      expect.stringContaining('ICCID 8901 — BILLION F017 error: 1001'),
      expect.stringContaining('ICCID 8902 — BILLION F017 error: 1001'),
    ]);
  });
});

describe('Billion N004 / N005 notices (vande #004)', () => {
  function makeOrders(row: Record<string, unknown> | undefined) {
    const queries: unknown[][] = [];
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      dataSource: {
        query: jest.fn((q: string, params: unknown[]) => {
          queries.push([q, params]);
          return Promise.resolve(q.startsWith('SELECT') && row ? [row] : []);
        }),
      },
    });
    return { service, queries };
  }

  it('should note on the order what Billion decided', async () => {
    const { service, queries } = makeOrders({
      id: 3,
      orderId: 7,
      iccids: '8902',
      status: 'pending',
      opinion: null,
    });
    const webhooks = Object.create(
      WebhooksService.prototype,
    ) as WebhooksService;
    Object.assign(webhooks, {
      ordersService: service,
      logger: { log: jest.fn(), warn: jest.fn() },
    });

    await webhooks.handleBillionEvent({
      tradeType: 'N004',
      tradeTime: '2026-10-26 10:00:00',
      tradeData: {
        afterSaleId: 'AS20',
        auditStatus: '1',
        auditOpinion: '同意',
      },
    });

    expect(queries[1]).toEqual([
      expect.stringContaining('UPDATE billion_after_sale'),
      [3, 'approved', '同意'],
    ]);
    expect(queries[2][1]).toEqual([
      7,
      'Billion đã duyệt yêu cầu hoàn tiền #AS20 (ICCID 8902): "同意" — chờ Billion hoàn tiền.',
    ]);
  });

  it('should not reopen a request already refunded', async () => {
    const { service, queries } = makeOrders({
      id: 3,
      orderId: 7,
      iccids: '8902',
      status: 'refunded',
      opinion: null,
    });
    expect(
      await service.recordBillionAfterSale('AS20', {
        status: 'approved',
        opinion: null,
      }),
    ).toBe(false);
    expect(queries).toHaveLength(1);
  });

  it('should ignore a request we never sent', async () => {
    const { service } = makeOrders(undefined);
    expect(
      await service.recordBillionAfterSale('X', {
        status: 'refunded',
        opinion: null,
      }),
    ).toBe(false);
  });
});
