import { esimAccessTakesTopup } from '../esim-providers/esimaccess/esimaccess.service';
import { TopupService } from './topup.service';

describe('Topup gói ngày esimaccess (vande-0411 #022)', () => {
  it('should read a day pass as taking a top-up', () => {
    expect(esimAccessTakesTopup(3)).toBe(true);
    expect(esimAccessTakesTopup(2)).toBe(true);
    expect(esimAccessTakesTopup(1)).toBe(false);
  });

  function service(pkg: Record<string, unknown>) {
    const svc = Object.create(TopupService.prototype) as TopupService;
    const calculate = jest.fn().mockResolvedValue(250000);
    Object.assign(svc, {
      profitMarginsService: { calculateRetailVndFromCostUsd: calculate },
      listProviderPackages: jest.fn().mockResolvedValue({ packages: [pkg] }),
      fetchVndRate: jest.fn().mockResolvedValue(25000),
    });
    return { svc, calculate };
  }

  it('should price N days on their whole cost', async () => {
    const { svc, calculate } = service({
      packageId: 'TOPUP_A',
      isDayPass: true,
      price: 1.5,
      vndPrice: 60000,
    });

    await expect(svc.priceForDays('8901', 'TOPUP_A', 3)).resolves.toEqual({
      days: 3,
      vndPrice: 250000,
    });
    expect(calculate).toHaveBeenCalledWith(4.5, 25000);
  });

  it('should not multiply a package that is not a day pass', async () => {
    const { svc, calculate } = service({
      packageId: 'TOPUP_B',
      price: 1.5,
      vndPrice: 60000,
    });

    await expect(svc.priceForDays('8901', 'TOPUP_B', 3)).resolves.toEqual({
      days: 1,
      vndPrice: 60000,
    });
    expect(calculate).not.toHaveBeenCalled();
  });

  it('should refuse a package this eSIM does not list', async () => {
    const { svc } = service({ packageId: 'TOPUP_A' });

    await expect(svc.priceForDays('8901', 'OTHER', 3)).rejects.toThrow(
      'Topup package not found',
    );
  });
});
