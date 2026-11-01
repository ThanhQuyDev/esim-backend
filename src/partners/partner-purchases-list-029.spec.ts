import { PartnersService, purchaseEsims } from './partners.service';

/**
 * doitac-3010 #029 — the distribution partner's "Đơn hàng": one search box,
 * each order's eSIMs with the request open on them, and this month against
 * last.
 */
describe('Partner orders list (doitac-3010 #029)', () => {
  it('should search the order number, email, ICCID and plan names with one box', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const s = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(s, {
      getPartnerOrThrowById: jest
        .fn()
        .mockResolvedValue({ id: 2, userId: 280 }),
      dataSource: { query },
    });

    await s.getMyPurchases(2, { search: '#8931087' });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[2]).toBe('8931087');
    for (const column of [
      'o."orderNumber" ILIKE',
      'o."deliveryEmail" ILIKE',
      'o."targetIccid" ILIKE',
      'sp."standardName" ILIKE',
      'se.iccid ILIKE',
    ]) {
      expect(sql).toContain(column);
    }
  });

  it("should list an order's eSIMs, refundable or not, with the open request", () => {
    expect(
      purchaseEsims([
        {
          iccid: '111',
          provider: 'billion',
          name: 'Japan 5GB',
          openReport: 'fault',
        },
        { iccid: '222', provider: 'viettel', name: 'Viettel 5GB' },
        { iccid: null },
      ]),
    ).toEqual({
      esims: [
        { iccid: '111', refundable: expect.any(Boolean), openReport: 'fault' },
        { iccid: '222', refundable: expect.any(Boolean), openReport: null },
      ],
      openReport: 'fault',
    });
  });

  it('should show a refund under review before a fault', () => {
    expect(
      purchaseEsims([
        { iccid: '1', openReport: 'fault' },
        { iccid: '2', openReport: 'refund' },
      ]).openReport,
    ).toBe('refund');
    expect(purchaseEsims(null)).toEqual({ esims: [], openReport: null });
  });

  it('should sum this month and last month apart', async () => {
    const s = Object.create(PartnersService.prototype) as PartnersService;
    const query = jest.fn().mockResolvedValue([
      {
        month: 'this',
        orders: 3,
        paidVnd: '1027000',
        refundedVnd: '0',
        esims: '5',
      },
      {
        month: 'last',
        orders: 1,
        paidVnd: '200000',
        refundedVnd: '50000',
        esims: '1',
      },
    ]);
    Object.assign(s, {
      getPartnerOrThrowById: jest
        .fn()
        .mockResolvedValue({ id: 2, userId: 280 }),
      dataSource: { query },
    });
    await expect(
      s.getMyPurchaseSummary(2, new Date('2026-11-05T00:00:00Z')),
    ).resolves.toEqual({
      thisMonth: { orders: 3, paidVnd: 1027000, esims: 5, refundedVnd: 0 },
      lastMonth: { orders: 1, paidVnd: 200000, esims: 1, refundedVnd: 50000 },
    });
    expect(query.mock.calls[0][1]).toEqual([
      280,
      new Date('2026-10-31T17:00:00Z'),
      new Date('2026-11-30T17:00:00Z'),
      new Date('2026-09-30T17:00:00Z'),
    ]);
  });
});
