import { PartnersService } from './partners.service';

/**
 * "Đơn hàng đối tác" for the admin, test round of 14/10 (doitac-1410 #058):
 * the partner's own filters on both tabs, a company by its own name, and a
 * refund that returns a distribution partner's money to their wallet.
 */

function buildListService() {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const getMyOrders = jest.fn().mockResolvedValue([]);
  const getMyPurchases = jest.fn().mockResolvedValue([]);
  Object.assign(service, { getMyOrders, getMyPurchases });
  return { service, getMyOrders, getMyPurchases };
}

describe('Đơn hàng đối tác filters (doitac-1410 #058)', () => {
  it('should pass the distribution filters through to the purchases screen', async () => {
    const { service, getMyPurchases } = buildListService();

    await service.adminListPartnerOrders({
      partnerType: 'distribution',
      iccid: '8985',
      planName: 'Nhật',
      email: 'khach@',
      orderType: 'TOPUP',
      from: '2026-10-01',
      to: '2026-10-15',
    });

    expect(getMyPurchases).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        iccid: '8985',
        planName: 'Nhật',
        email: 'khach@',
        orderType: 'TOPUP',
        from: '2026-10-01',
        to: '2026-10-15',
      }),
    );
  });

  it('should read a marketing date range as whole Vietnamese days', async () => {
    const { service, getMyOrders } = buildListService();

    await service.adminListPartnerOrders({
      partnerType: 'kol',
      from: '2026-10-01',
      to: '2026-10-15',
      source: 'coupon',
    });

    const [, , filters] = getMyOrders.mock.calls[0] as [
      null,
      number,
      { from: Date; to: Date; source: string },
    ];
    // 00:00 on 1/10 in Vietnam is 17:00 on 30/9 UTC.
    expect(filters.from.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(filters.to.toISOString()).toBe('2026-10-15T17:00:00.000Z');
    expect(filters.source).toBe('coupon');
  });

  it('should take every row for the file', async () => {
    const { service, getMyOrders } = buildListService();

    await service.adminListPartnerOrders({ unbounded: true });

    expect(getMyOrders).toHaveBeenCalledWith(null, 5000, expect.any(Object));
  });
});

describe('getMyOrders filters (doitac-1410 #058)', () => {
  function buildOrdersService() {
    const query = jest.fn().mockResolvedValue([]);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, { dataSource: { query } });
    return { service, query };
  }

  it('should search ICCID, product and email without dropping other lines', async () => {
    const { service, query } = buildOrdersService();

    await service.getMyOrders(null, 50, {
      planName: 'Nhật',
      iccid: '8985',
      email: 'khach@',
      source: 'link',
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params.slice(6)).toEqual(['Nhật', '8985', 'khach@', 'link']);
    expect(sql).toContain('fp.name ILIKE');
    expect(sql).toContain('fe.iccid ILIKE');
    expect(sql).toContain('fu.email ILIKE');
  });

  it('should ignore an unknown source', async () => {
    const { service, query } = buildOrdersService();

    await service.getMyOrders(null, 50, { source: 'facebook' });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[9]).toBeNull();
  });

  it('should name a company partner by the company', async () => {
    const { service, query } = buildOrdersService();

    await service.getMyOrders(null, 50);

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain(`pa."legalType" = 'company'`);
  });
});

describe('PartnersService.adminRefundPartnerPurchase (doitac-1410 #058)', () => {
  const ORDER = {
    id: 77,
    orderNumber: 'ORD-77',
    orderType: 'BUY_NEW',
    status: 'paid',
    partnerId: 11,
    remainingVnd: '300000',
  };

  function buildRefundService(opts: {
    order?: Record<string, unknown> | null;
    esims?: Record<string, unknown>[];
    bare?: Record<string, unknown>[];
  }) {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('"remainingVnd"')) {
        return Promise.resolve(
          opts.order === null ? [] : [opts.order ?? ORDER],
        );
      }
      if (sql.includes('SELECT e.iccid')) {
        return Promise.resolve(opts.esims ?? []);
      }
      if (sql.includes('NOT EXISTS (SELECT 1 FROM esim e WHERE')) {
        return Promise.resolve(opts.bare ?? []);
      }
      return Promise.resolve([]);
    });
    const refundWalletForPurchase = jest.fn().mockResolvedValue({});
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, { dataSource: { query }, refundWalletForPurchase });
    return { service, query, refundWalletForPurchase };
  }

  const REASON = 'eSIM lỗi kết nối';

  it('should give each picked eSIM its agent price back to the wallet', async () => {
    const { service, refundWalletForPurchase, query } = buildRefundService({
      esims: [
        { iccid: 'A1', itemId: 5, vndPrice: '120000' },
        { iccid: 'A2', itemId: 5, vndPrice: '120000' },
      ],
    });

    const result = await service.adminRefundPartnerPurchase(
      'ORD-77',
      { iccids: ['A1', 'A2'], reason: REASON },
      1,
    );

    expect(result).toEqual({ refundedVnd: 240000, esims: ['A1', 'A2'] });
    expect(refundWalletForPurchase).toHaveBeenCalledTimes(2);
    expect(refundWalletForPurchase).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ amountVnd: 120000, suffix: 'admin-A1' }),
    );
    const sqls = query.mock.calls.map(([q]) => q as string);
    expect(sqls.some((q) => q.includes('UPDATE esim SET status'))).toBe(true);
    // A pending fault report cannot be approved into a second refund.
    expect(
      sqls.some((q) => q.includes('UPDATE partner_esim_fault_report')),
    ).toBe(true);
  });

  it('should never give back more than the order cost', async () => {
    const { service, refundWalletForPurchase } = buildRefundService({
      order: { ...ORDER, remainingVnd: '150000' },
      esims: [
        { iccid: 'A1', itemId: 5, vndPrice: '120000' },
        { iccid: 'A2', itemId: 5, vndPrice: '120000' },
      ],
    });

    const result = await service.adminRefundPartnerPurchase(
      'ORD-77',
      { itemIds: [5], reason: REASON },
      1,
    );

    expect(result.refundedVnd).toBe(150000);
    expect(refundWalletForPurchase.mock.calls[1][1].amountVnd).toBe(30000);
  });

  it('should refund a product line that never got its eSIMs by the line', async () => {
    const { service, refundWalletForPurchase } = buildRefundService({
      esims: [],
      bare: [{ id: 6, vndPrice: '50000', quantity: 2 }],
    });

    const result = await service.adminRefundPartnerPurchase(
      'ORD-77',
      { itemIds: [6], reason: REASON },
      1,
    );

    expect(result.refundedVnd).toBe(100000);
    expect(refundWalletForPurchase).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ suffix: 'admin-item-6' }),
    );
  });

  it('should give a topup back whole', async () => {
    const { service, refundWalletForPurchase } = buildRefundService({
      order: { ...ORDER, orderType: 'TOPUP', remainingVnd: '99000' },
    });

    const result = await service.adminRefundPartnerPurchase(
      'ORD-77',
      { reason: 'Nạp topup thất bại' },
      1,
    );

    expect(result.refundedVnd).toBe(99000);
    expect(refundWalletForPurchase).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ suffix: 'admin-topup' }),
    );
  });

  it('should refuse a reason too short to tell the partner anything', async () => {
    const { service } = buildRefundService({});

    await expect(
      service.adminRefundPartnerPurchase(
        'ORD-77',
        { iccids: ['A1'], reason: 'lỗi' },
        1,
      ),
    ).rejects.toThrow('lý do hoàn tiền');
  });

  it('should refuse an order already refunded in full', async () => {
    const { service } = buildRefundService({
      order: { ...ORDER, remainingVnd: '0' },
    });

    await expect(
      service.adminRefundPartnerPurchase(
        'ORD-77',
        { iccids: ['A1'], reason: REASON },
        1,
      ),
    ).rejects.toThrow('đã được hoàn tiền hết');
  });

  it('should say so when every picked eSIM was already refunded', async () => {
    const { service } = buildRefundService({ esims: [] });

    await expect(
      service.adminRefundPartnerPurchase(
        'ORD-77',
        { iccids: ['A1'], reason: REASON },
        1,
      ),
    ).rejects.toThrow('đều đã được hoàn tiền');
  });

  it('should not find an order that is not a distribution purchase', async () => {
    const { service } = buildRefundService({ order: null });

    await expect(
      service.adminRefundPartnerPurchase(
        'ORD-1',
        { iccids: ['A1'], reason: REASON },
        1,
      ),
    ).rejects.toThrow('Không tìm thấy đơn hàng');
  });
});
