import { OrdersService } from './orders.service';
import { allocateDiscount, netLineVnd } from './order-refund-values';
import { computeCouponDiscount } from '../coupons/coupon-discount';
import { partnerCommissionAmount } from '../partners/partner-commission-amount';

/**
 * vande #080 — anh Thọ's worked example (hình 3): a partner's 5% code on an
 * order of 3 lines, 2,145,000đ in all, at a 20% commission rate. The
 * discount was rounded to the thousand (107,000 instead of 107,250), so the
 * refund popup showed 684,084đ for a line that cost the customer 684,000đ.
 */
const lines = [
  // Oceania unlimited · 7 ngày, 2 × 465,000
  { id: 104, vndPrice: 930000, quantity: 2 },
  // Vietnam unlimited · 3 ngày, 2 × 360,000
  { id: 102, vndPrice: 720000, quantity: 2 },
  // Canary Islands 10GB · 30 ngày, 3 × 165,000
  { id: 103, vndPrice: 495000, quantity: 3 },
];
const subtotal = 2145000;
const coupon = {
  discountType: 'percentage',
  discountPercent: 5,
  maxDiscountAmount: null,
} as never;

describe('Partner percentage code (vande #080)', () => {
  it('should take 5% to the đồng, then share it out exactly per line', () => {
    const discount = computeCouponDiscount(coupon, subtotal);
    expect(discount).toBe(107250);

    const shares = allocateDiscount(lines, discount);
    expect(shares.get(104)).toBe(46500);
    expect(shares.get(102)).toBe(36000);
    expect(shares.get(103)).toBe(24750);

    expect(netLineVnd(lines[0], shares.get(104)!)).toBe(883500);
    expect(netLineVnd(lines[1], shares.get(102)!)).toBe(684000);
    expect(netLineVnd(lines[2], shares.get(103)!)).toBe(470250);
  });

  it('should pay the partner (20% - 5%) of the list price, 321,750đ', () => {
    const { commissionVnd } = partnerCommissionAmount({
      orderValueVnd: subtotal - 107250,
      commissionPercent: 20,
      ownCouponDiscountVnd: 107250,
    });
    expect(commissionVnd).toBe(321750);
  });

  it('should charge the order with the discount to the đồng, not the thousand', async () => {
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      plansService: { marginTiers: jest.fn().mockResolvedValue([]) },
      couponsService: {
        validateCoupon: jest.fn().mockResolvedValue({
          discountAmount: 107250,
          effectiveDiscountPercent: 5,
        }),
      },
      usersService: {
        findById: jest.fn().mockResolvedValue({ id: 1, tierBenefits: {} }),
      },
    });
    const plan = (vndPrice: number) => ({
      vndPrice,
      usdPrice: vndPrice / 26000,
      price: vndPrice / 26000,
      discount: 0,
      isAbleMultidate: false,
    });

    const pricing = await (
      service as unknown as {
        calculateOrderPricing: (
          userId: number,
          dto: object,
          details: object[],
        ) => Promise<{
          couponDiscountVndAmount: number;
          payableVndPrice: number;
        }>;
      }
    ).calculateOrderPricing(1, { couponCode: 'MA2026', items: [] }, [
      { planId: 1, quantity: 2, plan: plan(465000) },
      { planId: 2, quantity: 2, plan: plan(360000) },
      { planId: 3, quantity: 3, plan: plan(165000) },
    ]);

    expect(pricing.couponDiscountVndAmount).toBe(107250);
    expect(pricing.payableVndPrice).toBe(2037750);
  });
});
