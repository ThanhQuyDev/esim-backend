import { of, throwError } from 'rxjs';
import { AiraloService } from './airalo.service';
import {
  airaloRefundBody,
  chunkIccids,
  parseAiraloRefundResponse,
} from './airalo-refund';
import { OrdersService } from '../../orders/orders.service';

/** Airalo refund request, POST /v2/refund (doitac-1410 #079). Never the real API. */

describe('Airalo refund helpers', () => {
  it('should split ICCIDs in fives, without duplicates', () => {
    const iccids = ['1', '2', '3', '4', '5', '6', '2', ''];
    expect(chunkIccids(iccids)).toEqual([['1', '2', '3', '4', '5'], ['6']]);
    expect(chunkIccids([])).toEqual([]);
  });

  it('should always give OTHERS a note and cap notes at 255', () => {
    expect(airaloRefundBody({ iccids: ['1'], reason: 'OTHERS' })).toEqual({
      iccids: ['1'],
      reason: 'OTHERS',
      notes: 'Refund requested by esim.vn',
    });
    const long = airaloRefundBody({
      iccids: ['1'],
      reason: 'NO_COVERAGE',
      notes: 'x'.repeat(300),
    });
    expect(long.notes).toHaveLength(255);
    expect(
      airaloRefundBody({ iccids: ['1'], reason: 'NO_COVERAGE' }),
    ).not.toHaveProperty('notes');
  });

  it('should take only a reply with a refund_id', () => {
    expect(
      parseAiraloRefundResponse(
        {
          data: { refund_id: '12345', created_at: '2024-10-12 09:30' },
          meta: { message: 'success' },
        },
        ['1'],
      ),
    ).toEqual({
      refundId: '12345',
      createdAt: '2024-10-12 09:30',
      iccids: ['1'],
    });
    // Airalo refuses with a 202 too.
    expect(() =>
      parseAiraloRefundResponse(
        {
          data: [],
          meta: {
            message:
              'The following ICCIDs do not belong to your company: 894000000000001',
          },
        },
        ['894000000000001'],
      ),
    ).toThrow(/do not belong to your company/);
    expect(() =>
      parseAiraloRefundResponse(
        {
          data: { reason: 'The selected reason is invalid.' },
          meta: { message: 'the parameter is invalid' },
        },
        ['1'],
      ),
    ).toThrow(/parameter is invalid: The selected reason is invalid/);
  });
});

describe('AiraloService.requestRefund', () => {
  function makeService(post: jest.Mock) {
    const service = Object.create(AiraloService.prototype) as AiraloService;
    const internals = service as unknown as Record<string, unknown>;
    internals.httpService = { post };
    internals.configService = {
      getOrThrow: jest.fn(() => 'https://airalo.test'),
    };
    internals.logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    internals.authenticate = jest.fn().mockResolvedValue('TOKEN');
    return service;
  }

  it('should send one request per five ICCIDs with the bearer token', async () => {
    let n = 0;
    const post = jest.fn(() =>
      of({ data: { data: { refund_id: `R${++n}` }, meta: {} } }),
    );
    const service = makeService(post);

    const results = await service.requestRefund({
      iccids: ['1', '2', '3', '4', '5', '6', '7'],
      reason: 'TRIP_CANCELLATION',
      notes: 'Khach huy chuyen',
    });

    expect(results.map((r) => r.refundId)).toEqual(['R1', 'R2']);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenNthCalledWith(
      1,
      'https://airalo.test/v2/refund',
      {
        iccids: ['1', '2', '3', '4', '5'],
        reason: 'TRIP_CANCELLATION',
        notes: 'Khach huy chuyen',
      },
      {
        headers: { Authorization: 'Bearer TOKEN', Accept: 'application/json' },
      },
    );
    expect((post.mock.calls[1] as unknown[])[1]).toMatchObject({
      iccids: ['6', '7'],
    });
  });

  it("should throw Airalo's reason on 422 / 429", async () => {
    const post = jest.fn(() =>
      throwError(() => ({
        message: 'Request failed',
        response: { status: 429, data: { message: 'Too Many Attempts.' } },
      })),
    );
    await expect(
      makeService(post).requestRefund({ iccids: ['1'], reason: 'OTHERS' }),
    ).rejects.toThrow('Airalo refund request failed (429): Too Many Attempts.');
  });
});

describe('Order refund → Airalo refund request', () => {
  const ORDER = { id: 7, orderNumber: 'ESIM-7', attributedPartnerId: null };
  const ITEMS = [
    { id: 11, vndPrice: 300000, quantity: 3, planId: 1 }, // airalo
    { id: 12, vndPrice: 50000, quantity: 1, planId: 2 }, // esimaccess
  ];

  function makeOrders(requestRefund: jest.Mock) {
    const esims = [
      { id: 101, orderItemId: 11, iccid: '8901', status: 'sold' },
      { id: 102, orderItemId: 11, iccid: '8902', status: 'sold' },
      { id: 103, orderItemId: 11, iccid: '8903', status: 'refunded' },
      {
        id: 104,
        orderItemId: 12,
        iccid: '8904',
        status: 'sold',
        esimTranNo: 'T4',
      },
    ];
    const notes: string[] = [];
    const service = Object.create(OrdersService.prototype) as OrdersService;
    const internals = service as unknown as Record<string, unknown>;
    internals.orderRepository = {
      findById: jest.fn().mockResolvedValue(ORDER),
    };
    internals.orderItemsService = {
      findByOrderId: jest.fn().mockResolvedValue(ITEMS),
      update: jest.fn().mockResolvedValue({}),
    };
    internals.esimsService = {
      findByOrderItemIds: jest.fn((ids: number[]) =>
        Promise.resolve(esims.filter((e) => ids.includes(e.orderItemId))),
      ),
      update: jest.fn().mockResolvedValue({}),
    };
    internals.plansService = {
      findById: jest.fn((id: number) =>
        Promise.resolve(
          id === 1
            ? { provider: 'airalo', isLocalInventory: false }
            : { provider: 'esimaccess', isLocalInventory: false },
        ),
      ),
    };
    internals.esimAccessService = { cancelEsim: jest.fn() };
    internals.airaloService = { requestRefund };
    internals.walletsService = {
      refundOrder: jest.fn().mockResolvedValue({ id: 1 }),
    };
    internals.dataSource = { query: jest.fn().mockResolvedValue([]) };
    internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    internals.cancelOrderWithSuppliers = jest.fn().mockResolvedValue([]);
    internals.markRefundedEsims = jest.fn().mockResolvedValue(0);
    internals.addOrderNote = jest.fn((_id: number, body: string) => {
      notes.push(body);
      return Promise.resolve({});
    });
    return { service, notes };
  }

  it('should ask Airalo for the Airalo eSIMs not yet refunded, and note it', async () => {
    const requestRefund = jest
      .fn()
      .mockResolvedValue([
        { refundId: '555', createdAt: null, iccids: ['8901', '8902'] },
      ]);
    const { service, notes } = makeOrders(requestRefund);

    const res = await service.refundOrder(
      7 as never,
      {
        mode: 'wallet',
        amountVnd: 100000,
        reason: 'Khach huy chuyen',
        airaloRefundReason: 'TRIP_CANCELLATION',
      } as never,
      1,
    );

    expect(requestRefund).toHaveBeenCalledWith({
      iccids: ['8901', '8902'],
      reason: 'TRIP_CANCELLATION',
      notes: 'Khach huy chuyen — Order ESIM-7',
    });
    expect(res.supplierRequests).toEqual([expect.stringContaining('#555')]);
    expect(notes).toEqual([expect.stringContaining('#555')]);
  });

  it('should send a picked Airalo eSIM on its own', async () => {
    const requestRefund = jest
      .fn()
      .mockResolvedValue([
        { refundId: '9', createdAt: null, iccids: ['8902'] },
      ]);
    const { service } = makeOrders(requestRefund);

    const res = await service.refundOrder(
      7 as never,
      {
        mode: 'wallet',
        amountVnd: 100000,
        esimIds: [102],
        airaloRefundReason: 'NO_COVERAGE',
      } as never,
      1,
    );

    expect(requestRefund).toHaveBeenCalledWith(
      expect.objectContaining({ iccids: ['8902'], reason: 'NO_COVERAGE' }),
    );
    // Handled by the request: no "contact the supplier" warning for it.
    expect(res.supplierWarnings).toEqual([]);
  });

  it('should not ask Airalo unless the admin picked a reason', async () => {
    const requestRefund = jest.fn();
    const { service } = makeOrders(requestRefund);

    await service.refundOrder(
      7 as never,
      { mode: 'wallet', amountVnd: 100000 } as never,
      1,
    );

    expect(requestRefund).not.toHaveBeenCalled();
  });

  it('should still refund the customer when Airalo refuses', async () => {
    const requestRefund = jest
      .fn()
      .mockRejectedValue(new Error('ICCIDs do not belong to your company'));
    const { service, notes } = makeOrders(requestRefund);

    const res = await service.refundOrder(
      7 as never,
      {
        mode: 'wallet',
        amountVnd: 100000,
        airaloRefundReason: 'OTHERS',
      } as never,
      1,
    );

    expect(res.id).toBe(1);
    expect(res.supplierWarnings).toEqual([
      expect.stringContaining('do not belong to your company'),
    ]);
    expect(notes).toHaveLength(1);
  });
});
