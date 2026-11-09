import { PartnersService } from './partners.service';

/**
 * doitac-0911 #002: when an admin refunds a distribution partner's eSIM, the
 * topups and add-ons the partner bought for it from the deposit wallet go
 * back with it, and each topup order reads "Đã hoàn tiền".
 */
function build(rooms: Record<number, number>) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    if (/FROM "order" o\s+WHERE o."orderType" = 'TOPUP'/.test(sql)) {
      return Promise.resolve([
        {
          id: 100,
          orderNumber: 'TOPUP-A',
          userId: 20,
          targetIccid: '8900000833431757341',
        },
        {
          id: 101,
          orderNumber: 'TOPUP-B',
          userId: 20,
          targetIccid: '8900000833431757341',
        },
      ]);
    }
    return Promise.resolve([]);
  });
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const refundWalletForPurchase = jest.fn().mockResolvedValue(undefined);
  Object.assign(service as unknown as Record<string, unknown>, {
    dataSource: { query },
    logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
    refundWalletForPurchase,
    partnerPurchaseRefundRoom: jest.fn((orderId: number) =>
      Promise.resolve(
        orderId in rooms
          ? { partnerId: 11, remainingVnd: rooms[orderId] }
          : null,
      ),
    ),
  });
  return { service, queries, refundWalletForPurchase };
}

describe('PartnersService.refundPartnerTopupsOfIccids (doitac-0911 #002)', () => {
  it('should pay each topup back to the deposit wallet and mark it refunded', async () => {
    const { service, queries, refundWalletForPurchase } = build({
      100: 137000,
      101: 0, // already given back by hand
    });

    const result = await service.refundPartnerTopupsOfIccids(
      ['8900000833431757341'],
      { sourceOrderNumber: 'PTN-1', reason: 'eSIM chưa cài', adminId: 1 },
    );

    expect(refundWalletForPurchase).toHaveBeenCalledTimes(1);
    expect(refundWalletForPurchase).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        orderId: 100,
        orderNumber: 'TOPUP-A',
        amountVnd: 137000,
        suffix: 'with-esim',
        createdByAdminId: 1,
      }),
    );
    const marked = queries.filter((q) =>
      /UPDATE "order"\s+SET status = 'refunded'/.test(q.sql),
    );
    expect(marked.map((q) => q.params)).toEqual([[100, 137000]]);
    expect(
      queries.some(
        (q) =>
          /INSERT INTO order_refund/.test(q.sql) &&
          /'partner_wallet'/.test(q.sql),
      ),
    ).toBe(true);
    expect(result.refunded).toEqual([
      {
        orderNumber: 'TOPUP-A',
        amountVnd: 137000,
        iccid: '8900000833431757341',
      },
    ]);
  });

  it('should report a failure instead of stopping the eSIM refund', async () => {
    const { service, refundWalletForPurchase } = build({
      100: 137000,
      101: 50000,
    });
    refundWalletForPurchase.mockRejectedValueOnce(new Error('ví bị khoá'));

    const result = await service.refundPartnerTopupsOfIccids(
      ['8900000833431757341'],
      { sourceOrderNumber: 'PTN-1', reason: 'x', adminId: 1 },
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('TOPUP-A');
    expect(result.refunded.map((r) => r.orderNumber)).toEqual(['TOPUP-B']);
  });

  it('should do nothing without an ICCID', async () => {
    const { service, queries } = build({});
    const result = await service.refundPartnerTopupsOfIccids([], {
      sourceOrderNumber: 'PTN-1',
      reason: 'x',
      adminId: 1,
    });
    expect(queries).toHaveLength(0);
    expect(result).toEqual({ refunded: [], warnings: [] });
  });
});
