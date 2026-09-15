import { calculateCumulativeReversalVnd } from './wallets.refund';

describe('calculateCumulativeReversalVnd', () => {
  it('should reverse benefits proportionally across repeated partial refunds', () => {
    const originalRewardVnd = 20_000;
    const totalOrderValue = 100_000;

    const firstReversal = calculateCumulativeReversalVnd(
      originalRewardVnd,
      25_000,
      totalOrderValue,
      0,
    );
    const secondReversal = calculateCumulativeReversalVnd(
      originalRewardVnd,
      50_000,
      totalOrderValue,
      firstReversal,
    );

    expect(firstReversal).toBe(5_000);
    expect(secondReversal).toBe(5_000);
    expect(firstReversal + secondReversal).toBe(10_000);
  });

  it('should reverse the rounding remainder on the final refund', () => {
    const originalRewardVnd = 10_000;
    const totalOrderValue = 3;

    const firstReversal = calculateCumulativeReversalVnd(
      originalRewardVnd,
      1,
      totalOrderValue,
      0,
    );
    const secondReversal = calculateCumulativeReversalVnd(
      originalRewardVnd,
      2,
      totalOrderValue,
      firstReversal,
    );
    const finalReversal = calculateCumulativeReversalVnd(
      originalRewardVnd,
      3,
      totalOrderValue,
      firstReversal + secondReversal,
    );

    expect(firstReversal).toBe(3_333);
    expect(secondReversal).toBe(3_334);
    expect(finalReversal).toBe(3_333);
    expect(firstReversal + secondReversal + finalReversal).toBe(
      originalRewardVnd,
    );
  });

  it('should take each refunded product off lifetime spend at its own price (#022)', () => {
    // Beta order ORD-1789236698468-SCANU5: 999.000đ spent, then two products
    // refunded one at a time — 58.000đ, then 179.000đ. The customer list's
    // "Tổng chi tiêu" must drop by exactly those product prices, not stay at
    // the original order total.
    const spendVnd = 999_000;
    const totalOrderValue = 999_000;

    const first = calculateCumulativeReversalVnd(
      spendVnd,
      58_000,
      totalOrderValue,
      0,
    );
    const second = calculateCumulativeReversalVnd(
      spendVnd,
      58_000 + 179_000,
      totalOrderValue,
      first,
    );

    expect(first).toBe(58_000);
    expect(second).toBe(179_000);
    expect(spendVnd - first - second).toBe(762_000);
  });

  it('should not reverse more than the original benefit', () => {
    expect(
      calculateCumulativeReversalVnd(10_000, 100_000, 100_000, 10_000),
    ).toBe(0);
  });
});
