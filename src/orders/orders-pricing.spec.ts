import { Plan } from '../plans/domain/plan';
import { getDiscountedVndPrice, getPlanUsdPrice } from './orders.service';

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    price: 1.5,
    vndPrice: 38000,
    discount: 0,
    isAbleMultidate: false,
    ...overrides,
  } as Plan;
}

describe('multidate order pricing', () => {
  it('should charge the selected period for an eSIMAccess multidate plan', () => {
    const plan = makePlan({ isAbleMultidate: true });

    expect(getPlanUsdPrice(plan, 3)).toBe(4.5);
    expect(getDiscountedVndPrice(plan, 3)).toBe(114000);
  });

  it('should apply the discount after multiplying by the selected period', () => {
    const plan = makePlan({
      isAbleMultidate: true,
      vndPrice: 38000,
      discount: 10,
    });

    expect(getDiscountedVndPrice(plan, 3)).toBe(103000);
  });

  it('should not multiply fixed-duration plans even if periodNum is supplied', () => {
    const plan = makePlan({ isAbleMultidate: false });

    expect(getPlanUsdPrice(plan, 7)).toBe(1.5);
    expect(getDiscountedVndPrice(plan, 7)).toBe(38000);
  });
});

/**
 * `plan.price` means dollars for API suppliers but VND for local inventory
 * (Viettel and friends are imported from a spreadsheet priced in đồng). Reading
 * it as dollars recorded ~25,000x the real figure on those orders, which is
 * what made the USD totals in the CMS meaningless (#037).
 */
describe('USD price for suppliers that only quote VND', () => {
  const localPlan = {
    price: 69000, // đồng, despite the column name
    usdPrice: 2.65,
    isLocalInventory: true,
    type: 'fixed',
  } as never;

  it('should use the converted dollar price, not the VND figure', () => {
    expect(getPlanUsdPrice(localPlan)).toBe(2.65);
  });

  it('should never report the VND figure as dollars when no rate has run yet', () => {
    const notYetConverted = {
      price: 69000,
      usdPrice: 0,
      isLocalInventory: true,
      type: 'fixed',
    } as never;

    // 0 is wrong but obviously wrong; 69000 "USD" silently poisons every total.
    expect(getPlanUsdPrice(notYetConverted)).toBe(0);
  });

  it('should leave API suppliers exactly as before', () => {
    const airaloPlan = {
      price: 4.5,
      usdPrice: 4.5,
      isLocalInventory: false,
      type: 'fixed',
    } as never;

    expect(getPlanUsdPrice(airaloPlan)).toBe(4.5);
  });

  it('should still fall back to price for a non-local plan with no usdPrice yet', () => {
    const freshPlan = {
      price: 4.5,
      usdPrice: 0,
      isLocalInventory: false,
      type: 'fixed',
    } as never;

    expect(getPlanUsdPrice(freshPlan)).toBe(4.5);
  });
});
