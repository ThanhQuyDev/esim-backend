/**
 * The body of an eSIM Access order (#013, test round 4).
 *
 * eSIM Access checks `amount` against the packages ordered, and for a day
 * pass (a plan bought for N days) a package line costs price × count × days.
 * We sent price × count — the days were left out — so every day pass bought
 * for more than one day was refused with "200006 - the batchOrder's amount is
 * wrong". The customer had paid, nothing was ordered, and the order sat in
 * "pending" until someone noticed (7 such orders on production, Aug–Oct 2026,
 * all day passes of 3–4 days).
 *
 * Prices are in eSIM Access units: 1/10 000 USD.
 */
export interface EsimAccessOrderLine {
  packageCode: string;
  count: number;
  /** Unit price in USD — for a day pass, the price of ONE day. */
  unitPriceUsd: number;
  /** Days of a day pass; null / 0 for a fixed package. */
  periodNum?: number | null;
}

export function toEsimAccessUnits(usd: number): number {
  return Math.round(usd * 10000);
}

export function buildEsimAccessOrder(lines: EsimAccessOrderLine[]): {
  amount: number;
  packageInfoList: {
    packageCode: string;
    count: number;
    price: number;
    periodNum?: number | null;
  }[];
} {
  let amount = 0;
  const packageInfoList = lines.map((line) => {
    const price = toEsimAccessUnits(line.unitPriceUsd);
    const days = line.periodNum && line.periodNum > 0 ? line.periodNum : 1;
    amount += price * line.count * days;
    return {
      packageCode: line.packageCode,
      count: line.count,
      price,
      ...(line.periodNum ? { periodNum: line.periodNum } : {}),
    };
  });
  return { amount, packageInfoList };
}

/** eSIM Access refused the order because the price we sent is not theirs. */
export function isAmountMismatch(error: unknown): boolean {
  return /\b200006\b|amount is wrong/i.test(
    error instanceof Error ? error.message : String(error),
  );
}
