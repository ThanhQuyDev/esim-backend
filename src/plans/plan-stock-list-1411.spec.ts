import { PlansService } from './plans.service';

/**
 * vande-1411 #014: the CMS plan list says how many eSIMs of a Viettel /
 * domestic plan are left unsold, and how many of those have expired.
 */
describe('Số lượng hàng tồn trong danh sách gói (vande-1411 #014)', () => {
  it('should count the unsold eSIMs of local plans only', async () => {
    const service = Object.create(PlansService.prototype) as PlansService;
    const plans = [
      { id: 7, isLocalInventory: true },
      { id: 8, isLocalInventory: true },
      { id: 9, isLocalInventory: false },
    ] as Record<string, unknown>[];
    Object.assign(service as unknown as Record<string, unknown>, {
      plansRepository: {
        findManyWithPagination: jest.fn().mockResolvedValue([plans, 3]),
        countAvailableEsimsByPlanIds: jest
          .fn()
          .mockResolvedValue({ 7: { count: 10, earliestExpiresAt: null } }),
        countExpiredUnsoldEsimsByPlanIds: jest.fn().mockResolvedValue({ 7: 2 }),
      },
      enrichPlansWithRegionDestinations: jest.fn(),
      withAppSupport: jest.fn((list: unknown) => Promise.resolve(list)),
    });

    const [list] = await service.findManyWithPagination({
      paginationOptions: { page: 1, limit: 10 },
    });

    expect(list[0]).toMatchObject({ availableStock: 10, expiredStock: 2 });
    expect(list[1]).toMatchObject({ availableStock: 0, expiredStock: 0 });
    expect(list[2]).not.toHaveProperty('availableStock');
  });
});
