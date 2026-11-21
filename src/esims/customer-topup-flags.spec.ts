import { customerTopupFlags } from './customer-topup-flags';

/** vande-2011 #042: the card's top-up offer is decided by the API. */
describe('customerTopupFlags', () => {
  it('should follow the plan for Airalo, eSIM Access and Gadget Korea', () => {
    for (const provider of ['airalo', 'ESIM_ACCESS', 'gadgetkorea']) {
      expect(
        customerTopupFlags({
          provider,
          status: 'active',
          plan: { topUp: true },
        }),
      ).toEqual({ canTopUp: true, topupAsksPackages: false });
      expect(
        customerTopupFlags({
          provider,
          status: 'active',
          plan: { topUp: false },
        }).canTopUp,
      ).toBe(false);
    }
  });

  it('should ask the recharge list for Billion', () => {
    expect(
      customerTopupFlags({ provider: 'billion', status: 'active' }),
    ).toEqual({ canTopUp: true, topupAsksPackages: true });
  });

  it('should offer nothing for MicroEsim, domestic or a finished eSIM', () => {
    expect(
      customerTopupFlags({ provider: 'microesim', plan: { topUp: true } })
        .canTopUp,
    ).toBe(false);
    expect(customerTopupFlags({ provider: 'viettel' }).canTopUp).toBe(false);
    expect(
      customerTopupFlags({
        provider: 'airalo',
        status: 'refunded',
        plan: { topUp: true },
      }).canTopUp,
    ).toBe(false);
  });
});
