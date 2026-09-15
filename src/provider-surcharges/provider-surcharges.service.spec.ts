import { BadRequestException } from '@nestjs/common';
import { ProviderSurchargesService } from './provider-surcharges.service';

/**
 * #049 — "cộng thêm thuế phí cho một vài đối tác trước khi đem so sánh giá".
 */
describe('ProviderSurchargesService', () => {
  function setup(
    rows: { provider: string; percentage: string; note: string | null }[] = [],
    counts: { provider: string; count: string }[] = [],
  ) {
    const repository = {
      find: jest.fn().mockResolvedValue(rows),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      manager: { query: jest.fn().mockResolvedValue(counts) },
    };
    const plansService = {
      markCheapestPlans: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProviderSurchargesService(
      repository as never,
      plansService as never,
    );
    return { service, repository, plansService };
  }

  it('should list every known supplier, at 0% unless one is set', async () => {
    const { service } = setup(
      [{ provider: 'billion', percentage: '10.00', note: 'VAT' }],
      [
        { provider: 'billion', count: '1004' },
        { provider: 'newsupplier', count: '3' },
      ],
    );

    const list = await service.list();
    const billion = list.find((row) => row.provider === 'billion');

    expect(billion).toMatchObject({
      percentage: 10,
      note: 'VAT',
      activePlanCount: 1004,
    });
    expect(list.find((row) => row.provider === 'airalo')?.percentage).toBe(0);
    // A supplier that only exists in the plan table still shows up.
    expect(list.map((row) => row.provider)).toContain('newsupplier');
  });

  it('should save the surcharge and re-pick the cheapest plans', async () => {
    const { service, repository, plansService } = setup();

    await service.upsert(' Billion ', { percentage: 8.5, note: '  VAT  ' });

    expect(repository.save).toHaveBeenCalledWith({
      provider: 'billion',
      percentage: 8.5,
      note: 'VAT',
    });
    expect(plansService.markCheapestPlans).toHaveBeenCalledTimes(1);
  });

  it('should reject a provider that is not a slug', async () => {
    const { service, plansService } = setup();

    await expect(
      service.upsert('billion; DROP TABLE plan', { percentage: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(plansService.markCheapestPlans).not.toHaveBeenCalled();
  });
});
