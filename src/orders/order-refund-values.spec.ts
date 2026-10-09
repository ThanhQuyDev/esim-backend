import {
  allocateDiscount,
  netLineVnd,
  netUnitVnd,
  refundedCostVnd,
} from './order-refund-values';

/** The customer's own example (#009, test round 4). */
const LINES = [
  { id: 1, vndPrice: 250000 },
  { id: 2, vndPrice: 220000 },
  { id: 3, vndPrice: 172000 },
];

describe('discount shared over the lines (#009)', () => {
  it('should split a 10 000đ coupon by price, last line taking the remainder', () => {
    const shares = allocateDiscount(LINES, 10000);

    expect(shares.get(1)).toBe(3894); // 10 000 × 250 000 / 642 000
    expect(shares.get(2)).toBe(3427); // 10 000 × 220 000 / 642 000
    expect(shares.get(3)).toBe(2679); // remainder
    expect([...shares.values()].reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('should equal % × price for a 5% coupon', () => {
    const shares = allocateDiscount(LINES, 32100); // 5% of 642 000

    expect(shares.get(1)).toBe(12500);
    expect(shares.get(2)).toBe(11000);
    expect(shares.get(3)).toBe(8600);
  });

  it('should refund every line one by one for no more than was paid', () => {
    const shares = allocateDiscount(LINES, 10000);
    const refunded = LINES.reduce(
      (sum, line) => sum + netLineVnd(line, shares.get(line.id)!),
      0,
    );

    expect(refunded).toBe(632000);
  });

  it('should value one eSIM at the net line over its quantity', () => {
    expect(netUnitVnd({ id: 1, vndPrice: 300000, quantity: 3 }, 9000)).toBe(
      97000,
    );
  });

  it('should leave the lines whole without a discount', () => {
    expect([...allocateDiscount(LINES, 0).values()]).toEqual([0, 0, 0]);
  });

  it('should count the cost of refunded lines and single refunded eSIMs', () => {
    expect(
      refundedCostVnd(
        [
          { id: 1, vndPrice: 0, vndCostPrice: 90000, quantity: 3 },
          { id: 2, vndPrice: 0, vndCostPrice: 50000, status: 'refunded' },
        ],
        [
          { orderItemId: 1, status: 'refunded' },
          { orderItemId: 1, status: 'sold' },
        ],
      ),
    ).toBe(80000);
  });
});

/**
 * Affiliate orders (#010, test round 4): 7% commission on the order value after
 * the partner's coupon. A partial refund takes back
 * commission × refunded ÷ order value (adjustCommissionForPartialRefund), so
 * with refunds valued after the discount that is exactly 7% of each refunded
 * line's net value — and refunding every line takes it all back.
 */
describe('affiliate commission after a partial refund (#010)', () => {
  const reversal = (earned: number, refunded: number, orderValue: number) =>
    Math.min(earned, Math.round((earned * refunded) / orderValue));

  it('should take back 7% of the refunded line net value (10 000đ coupon)', () => {
    const shares = allocateDiscount(LINES, 10000);
    const orderValue = 632000;
    const commission = Math.round(orderValue * 0.07); // 44 240
    const line1 = netLineVnd(LINES[0], shares.get(1)!); // 246 106

    expect(commission).toBe(44240);
    expect(reversal(commission, line1, orderValue)).toBe(
      Math.round(line1 * 0.07),
    );
  });

  it('should take back 7% of the refunded line net value (2% coupon)', () => {
    const discount = 12840; // 2% of 642 000
    const shares = allocateDiscount(LINES, discount);
    const orderValue = 629160;
    const commission = Math.round(orderValue * 0.07);
    const line2 = netLineVnd(LINES[1], shares.get(2)!); // 215 600

    expect(line2).toBe(215600);
    expect(reversal(commission, line2, orderValue)).toBe(
      Math.round(line2 * 0.07),
    );
  });

  it('should take the whole commission back once every line is refunded', () => {
    const shares = allocateDiscount(LINES, 10000);
    const refunded = LINES.reduce(
      (sum, line) => sum + netLineVnd(line, shares.get(line.id)!),
      0,
    );

    expect(reversal(44240, refunded, 632000)).toBe(44240);
  });
});
