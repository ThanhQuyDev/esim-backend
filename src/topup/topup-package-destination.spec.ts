import { TopupService } from './topup.service';

/**
 * doitac-3010 #006 — "Topup hộ khách" listed "5 GB - 30 days" with no place,
 * so the admin or partner could not check it against the eSIM.
 */
describe('Topup packages carry the destination (doitac-3010 #006)', () => {
  function service(destination: string | null, names: string[]) {
    const svc = Object.create(TopupService.prototype) as TopupService;
    Object.assign(svc, {
      listProviderPackages: jest.fn().mockResolvedValue({
        iccid: '89',
        provider: 'airalo',
        packages: names.map((name, i) => ({ packageId: String(i), name })),
      }),
      esimsService: {
        findByIccid: jest.fn().mockResolvedValue({ planId: 3 }),
      },
      plansService: {
        findById: jest.fn().mockResolvedValue({
          destination: destination ? { name: destination } : null,
        }),
      },
    });
    return svc;
  }

  it('should put the country before the package name', async () => {
    const { packages } = await service('Seychelles', [
      '5 GB - 30 days',
    ]).listPackages('89');
    expect(packages[0].name).toBe('Seychelles - 5 GB - 30 days');
  });

  it('should not repeat a country the name already starts with', async () => {
    const { packages } = await service('Japan', ['Japan 3GB']).listPackages(
      '89',
    );
    expect(packages[0].name).toBe('Japan 3GB');
  });

  it('should leave the names alone when the plan has no destination', async () => {
    const { packages } = await service(null, ['1 GB']).listPackages('89');
    expect(packages[0].name).toBe('1 GB');
  });
});
