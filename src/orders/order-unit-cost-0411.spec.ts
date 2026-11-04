import { getPlanUnitCostVnd } from './orders.service';

/**
 * vande-0411 #004 — one cost figure. An order stores the plan's cost to the đồng
 * with the supplier's fee, the figure the plan list shows and the comparison reads.
 */
const plan = (over: Record<string, unknown>) => over as never;

describe('Giá vốn của dòng đơn (vande-0411 #004)', () => {
  it('should keep the odd dong, not the rounded 395 000', () => {
    expect(
      getPlanUnitCostVnd(
        plan({ costPrice: 15, vndCostPrice: 395_000, vndCostExact: 394_624 }),
        null,
        25_766,
      ),
    ).toBe(394_624);
  });

  it("should include the supplier's fee the bare cost leaves out", () => {
    // Gadget Korea, fee 20 %: 10$ × 25 000 = 250 000 without it.
    expect(
      getPlanUnitCostVnd(
        plan({ costPrice: 10, vndCostExact: 300_000 }),
        null,
        25_000,
      ),
    ).toBe(300_000);
  });

  it('should multiply a day pass by its days', () => {
    expect(
      getPlanUnitCostVnd(
        plan({
          isAbleMultidate: true,
          costPrice: 0.8,
          vndCostExact: 20_615.2522,
        }),
        14,
        25_766,
      ),
    ).toBe(288_614);
  });

  it('should fall back on the bare cost until the rate job fills the real one', () => {
    expect(
      getPlanUnitCostVnd(
        plan({ costPrice: 2, vndCostExact: null }),
        null,
        25_000,
      ),
    ).toBe(50_000);
    expect(
      getPlanUnitCostVnd(
        plan({ costPrice: 40_000, isLocalInventory: true }),
        null,
        25_000,
      ),
    ).toBe(40_000);
  });
});
