import { PartnersService } from './partners.service';

/**
 * The admin partner list's numbers (#095).
 *
 * The brief names six columns — "tên đối tác, tổng Đơn hàng, tổng Doanh thu,
 * Lợi nhuận, tỷ lệ đơn Hoàn tiền, Trạng thái" — and the list carried only a
 * 30-day revenue figure. An admin could not tell a partner who has sold
 * steadily all year from one who had a single good month, and could not see at
 * all that a partner's orders keep coming back as refunds.
 */
describe('PartnersService — admin list metrics', () => {
  /** Reaches the private method the two list endpoints share. */
  function attach(
    service: PartnersService,
    partners: { id: number }[],
  ): Promise<Record<string, unknown>[]> {
    return (
      service as unknown as {
        attachAdminListMetrics: (
          p: unknown[],
        ) => Promise<Record<string, unknown>[]>;
      }
    ).attachAdminListMetrics(partners);
  }

  function buildService(row: Record<string, unknown>) {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      dataSource: {
        query: jest.fn().mockResolvedValue([{ partnerId: 5, ...row }]),
      },
    });
    return service;
  }

  it('should report lifetime orders and revenue, not just the last 30 days', async () => {
    const service = buildService({
      totalOrders: 42,
      totalRevenueVnd: 84_000_000,
      revenue30dVnd: 3_000_000,
    });

    const [partner] = await attach(service, [{ id: 5 }]);

    expect(partner.totalOrders).toBe(42);
    expect(partner.totalRevenueVnd).toBe(84_000_000);
    expect(partner.revenue30dVnd).toBe(3_000_000);
  });

  it('should work the refund rate out by order count', async () => {
    const service = buildService({ refundedOrders: 3, settledOrders: 40 });

    const [partner] = await attach(service, [{ id: 5 }]);

    // 3 of 40 — refunds stay in the denominator, otherwise the rate flatters a
    // partner whose orders mostly came back.
    expect(partner.refundRatePercent).toBe(7.5);
  });

  it('should never divide by zero for a partner with no orders', async () => {
    const service = buildService({ refundedOrders: 0, settledOrders: 0 });

    const [partner] = await attach(service, [{ id: 5 }]);

    // A brand-new partner must read 0%, not NaN in the middle of the table.
    expect(partner.refundRatePercent).toBe(0);
  });

  it('should report the commission paid separately from the profit', async () => {
    // The two are related but answer different questions: profit is what the
    // partner contributed, total commission is what we owe/have paid them, and
    // a payout conversation starts from the second.
    const service = buildService({
      profitVnd: 12_500_000,
      totalCommissionVnd: 4_200_000,
    });

    const [partner] = await attach(service, [{ id: 5 }]);

    expect(partner.profitVnd).toBe(12_500_000);
    expect(partner.totalCommissionVnd).toBe(4_200_000);
  });

  it('should pass the profit figure through as the query computed it', async () => {
    // Revenue less cost of goods less the commission already credited: what the
    // partner actually contributed, which is the point of the column.
    const service = buildService({ profitVnd: 12_500_000 });

    const [partner] = await attach(service, [{ id: 5 }]);

    expect(partner.profitVnd).toBe(12_500_000);
  });

  it('should show zeroes rather than blanks for a partner the query returned nothing for', async () => {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      dataSource: { query: jest.fn().mockResolvedValue([]) },
    });

    const [partner] = await attach(service, [{ id: 5 }]);

    expect(partner).toMatchObject({
      totalOrders: 0,
      totalRevenueVnd: 0,
      profitVnd: 0,
      totalCommissionVnd: 0,
      refundRatePercent: 0,
      walletBalanceVnd: 0,
    });
  });

  describe("one partner's links and codes", () => {
    function buildMarketingService(exists = true) {
      const service = Object.create(
        PartnersService.prototype,
      ) as PartnersService;
      Object.assign(service, {
        getPartnerOrThrowById: jest.fn().mockImplementation(() => {
          if (!exists) return Promise.reject(new Error('Partner 9 not found'));
          return Promise.resolve({ id: 9 });
        }),
        getMyLinks: jest.fn().mockResolvedValue([{ id: 1, code: 'VANA2026' }]),
        getMyCoupons: jest.fn().mockResolvedValue([{ id: 2, code: 'VANA10' }]),
      });
      return service;
    }

    it('should return both the links and the discount codes', async () => {
      const service = buildMarketingService();

      const result = await service.adminGetPartnerMarketing(9);

      expect(result.links).toHaveLength(1);
      expect(result.coupons).toHaveLength(1);
    });

    it('should refuse an id that does not exist', async () => {
      // Two empty lists would read as "a real partner who has created nothing",
      // which is a different thing from a wrong id.
      const service = buildMarketingService(false);

      await expect(service.adminGetPartnerMarketing(9)).rejects.toThrow();
    });
  });

  it('should ask the database once for the whole page', async () => {
    const service = buildService({ totalOrders: 1 });

    await attach(service, [{ id: 5 }, { id: 6 }, { id: 7 }]);

    expect(
      (service as unknown as { dataSource: { query: jest.Mock } }).dataSource
        .query,
    ).toHaveBeenCalledTimes(1);
  });
});
