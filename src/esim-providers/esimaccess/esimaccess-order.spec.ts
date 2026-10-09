import { buildEsimAccessOrder, isAmountMismatch } from './esimaccess-order';

describe('eSIM Access order amount (#013, test round 4)', () => {
  it('should charge a day pass for every day bought', () => {
    // ORD-1791521353271-AUDM3C: Pakistan unlimited day pass, 4 days at 2.28.
    const order = buildEsimAccessOrder([
      { packageCode: 'PMK7E6A5F', count: 1, unitPriceUsd: 2.28, periodNum: 4 },
    ]);

    expect(order.amount).toBe(91200); // not 22 800
    expect(order.packageInfoList).toEqual([
      { packageCode: 'PMK7E6A5F', count: 1, price: 22800, periodNum: 4 },
    ]);
  });

  it('should leave a fixed package at price × count', () => {
    const order = buildEsimAccessOrder([
      { packageCode: 'JP5', count: 2, unitPriceUsd: 3.5, periodNum: null },
    ]);

    expect(order.amount).toBe(70000);
    expect(order.packageInfoList[0]).not.toHaveProperty('periodNum');
  });

  it('should add up mixed lines', () => {
    const order = buildEsimAccessOrder([
      { packageCode: 'A', count: 1, unitPriceUsd: 1.7, periodNum: 3 },
      { packageCode: 'B', count: 2, unitPriceUsd: 1, periodNum: 0 },
    ]);

    expect(order.amount).toBe(17000 * 3 + 10000 * 2);
  });

  it('should recognise the amount-mismatch refusal', () => {
    expect(
      isAmountMismatch(
        new Error(
          'EsimAccess order failed: 200006 - the batchOrder`s amount is wrong',
        ),
      ),
    ).toBe(true);
    expect(isAmountMismatch(new Error('timeout'))).toBe(false);
  });
});
