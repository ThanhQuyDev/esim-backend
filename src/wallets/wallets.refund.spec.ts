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

  it('should not reverse more than the original benefit', () => {
    expect(
      calculateCumulativeReversalVnd(10_000, 100_000, 100_000, 10_000),
    ).toBe(0);
  });
});
