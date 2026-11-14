import { getPlanUnitCostVnd } from './orders.service';
import {
  loadSurchargePercents,
  surchargeFactor,
  surchargeKey,
} from '../provider-surcharges/surcharge-percent';
import type { Plan } from '../plans/domain/plan';

/**
 * vande-1411 #006: an order kept its cost without the supplier's tax/fee when
 * the plan's đồng cost was not filled yet (Billion plans just after a sync),
 * so the order page and the overview's profit were off by the fee.
 */
describe('Giá vốn gồm thuế phí (vande-1411 #006)', () => {
  const billion = {
    provider: 'billion',
    costPrice: 1.87,
    currency: 'USD',
    isLocalInventory: false,
    isAbleMultidate: false,
    vndCostExact: null,
  } as unknown as Plan;

  it('should add the fee when the plan has no đồng cost yet', () => {
    // 1.87 USD at 25,796 đ and Billion's 20%: 57,886 đ, not 48,238 đ.
    expect(getPlanUnitCostVnd(billion, null, 25796, 1.2)).toBe(57886);
    expect(getPlanUnitCostVnd(billion, null, 25796)).toBe(48239);
  });

  it('should keep the exact cost, which already has the fee', () => {
    const plan = { ...billion, vndCostExact: 57650 } as unknown as Plan;
    expect(getPlanUnitCostVnd(plan, null, 25796, 1.2)).toBe(57650);
  });

  it('should add the fee to a plan quoted in đồng too', () => {
    const plan = {
      ...billion,
      currency: 'VND',
      costPrice: 100000,
    } as unknown as Plan;
    expect(getPlanUnitCostVnd(plan, null, 25796, 1.06)).toBe(106000);
  });

  it('should read the fee whichever way the supplier is spelled', async () => {
    const percents = await loadSurchargePercents({
      query: () =>
        Promise.resolve([
          { provider: 'gadgetkorea', percentage: '20.00' },
          { provider: 'microesim', percentage: 6 },
        ]),
    });
    expect(surchargeFactor(percents, 'GADGET_KOREA')).toBe(1.2);
    expect(surchargeFactor(percents, 'MICRO_ESIM')).toBe(1.06);
    expect(surchargeFactor(percents, 'airalo')).toBe(1);
    expect(surchargeKey('ESIM_ACCESS')).toBe('esimaccess');
  });

  it('should fall back to no fee when the table cannot be read', async () => {
    const percents = await loadSurchargePercents({
      query: () => Promise.reject(new Error('no table')),
    });
    expect(surchargeFactor(percents, 'billion')).toBe(1);
  });
});
