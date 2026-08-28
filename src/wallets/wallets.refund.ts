export function calculateCumulativeReversalVnd(
  originalAmountVnd: number,
  refundedAmountVnd: number,
  totalOrderValue: number,
  alreadyReversedVnd: number,
): number {
  const originalAmount = Math.max(0, Math.round(originalAmountVnd));
  if (originalAmount === 0 || totalOrderValue <= 0) return 0;

  const targetReversedVnd =
    refundedAmountVnd >= totalOrderValue
      ? originalAmount
      : Math.min(
          originalAmount,
          Math.round((originalAmount * refundedAmountVnd) / totalOrderValue),
        );

  return Math.max(0, targetReversedVnd - Math.max(0, alreadyReversedVnd));
}
