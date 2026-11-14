import { OrdersService } from './orders.service';

/**
 * vande-1411 #015: "Đặt đơn hộ" shows a line's cost and price once the plan,
 * the days and the quantity are picked — by the rules the order uses.
 */
describe('Giá vốn và giá bán khi đặt đơn hộ (vande-1411 #015)', () => {
  function service(plan: Record<string, unknown>) {
    const s = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(s as unknown as Record<string, unknown>, {
      plansService: {
        findForSale: jest.fn().mockResolvedValue(plan),
        marginTiers: jest.fn().mockResolvedValue([]),
      },
      exchangeRateService: {
        getUsdToVndRate: jest.fn().mockResolvedValue(25_000),
      },
      dataSource: {
        query: jest
          .fn()
          .mockResolvedValue([{ provider: 'billion', percentage: '20' }]),
      },
    });
    return s;
  }

  it('should give the cost of a day pass for the days chosen, in whole đồng', async () => {
    const q = await service({
      id: 1,
      provider: 'esimaccess',
      isAbleMultidate: true,
      costPrice: 0.8077,
      currency: 'USD',
      vndCostExact: 20_192.5,
      vndPrice: 35_000,
    }).manualOrderQuote({ planId: 1, days: 30, quantity: 2 });
    expect(q.days).toBe(30);
    expect(q.unitCostVnd).toBe(Math.round(20_192.5 * 30));
    expect(Number.isInteger(q.unitCostVnd)).toBe(true);
    expect(q.totalCostVnd).toBe(q.unitCostVnd * 2);
    expect(q.totalPriceVnd).toBe(q.unitPriceVnd * 2);
  });

  it('should ignore days on a plan sold for its own length', async () => {
    const q = await service({
      id: 2,
      provider: 'billion',
      isAbleMultidate: false,
      costPrice: 1.87,
      currency: 'USD',
      vndCostExact: null,
      vndPrice: 99_000,
    }).manualOrderQuote({ planId: 2, days: 30, quantity: 1 });
    expect(q.days).toBeNull();
    // 1.87 USD × 25,000 đ with Billion's 20% on top.
    expect(q.unitCostVnd).toBe(Math.round(1.87 * 1.2 * 25_000));
  });
});
