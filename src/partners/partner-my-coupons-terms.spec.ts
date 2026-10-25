import { PartnersService } from './partners.service';

/**
 * The partner's "Mã giảm giá" page only showed the % of each code (vande
 * #054): a partner could not tell a customer whether it was capped, needed a
 * minimum order or could be used twice.
 */
describe('PartnersService.getMyCoupons terms (vande #054)', () => {
  function serviceReturning(row: Record<string, unknown>) {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      dataSource: { query: jest.fn().mockResolvedValue([row]) },
    });
    return service;
  }

  it('should give the terms of a percentage code', async () => {
    const [coupon] = await serviceReturning({
      id: '3',
      code: 'VANA2026',
      discountPercent: '10.00',
      discountType: 'percent',
      discountAmount: '0.00',
      maxDiscountAmount: '50000.00',
      minOrderAmount: '300000.00',
      maxUsagePerUser: 1,
      usageCount: 2,
      maxUsage: 100,
    }).getMyCoupons(8);

    expect(coupon).toMatchObject({
      discountType: 'percent',
      discountPercent: 10,
      maxDiscountAmount: 50000,
      minOrderAmount: 300000,
      maxUsagePerUser: 1,
    });
  });

  it('should say "no limit" as null, not 0', async () => {
    const [coupon] = await serviceReturning({
      id: '4',
      code: 'GIAM50K',
      discountPercent: '0',
      discountType: 'fixed',
      discountAmount: '50000.00',
      maxDiscountAmount: null,
      minOrderAmount: null,
      maxUsagePerUser: null,
    }).getMyCoupons(8);

    expect(coupon).toMatchObject({
      discountType: 'fixed',
      discountAmount: 50000,
      maxDiscountAmount: null,
      minOrderAmount: null,
      maxUsagePerUser: null,
    });
  });
});
