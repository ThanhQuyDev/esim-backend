import { PlansService } from './plans.service';
import { PlansRelationalRepository } from './infrastructure/persistence/relational/repositories/plan.repository';

/**
 * "Local" (doitac-1410 #072): an eSIM nội địa shows on its carrier's own page
 * and never among Vietnam's travel eSIMs; the CMS can filter and set it.
 */

describe('Vietnam travel page leaves Local plans out (doitac-1410 #072)', () => {
  function buildService() {
    const findManyWithPagination = jest.fn().mockResolvedValue([[], 0]);
    const service = Object.create(PlansService.prototype) as PlansService;
    Object.assign(service, {
      plansRepository: { findManyWithPagination },
      attachStorefrontFacts: jest.fn().mockResolvedValue([]),
      destinationsService: {
        findBySlug: jest.fn().mockResolvedValue({ id: 245 }),
      },
      regionsService: { findBySlug: jest.fn().mockResolvedValue({ id: 3 }) },
    });
    return { service, findManyWithPagination };
  }

  it('should ask a destination for travel eSIMs only', async () => {
    const { service, findManyWithPagination } = buildService();

    await service.findPlansByDestination('esim-vietnam');

    expect(findManyWithPagination.mock.calls[0][0].filterOptions).toEqual({
      destinationId: 245,
      isActive: true,
      isDomesticEsim: false,
    });
  });

  it('should ask a region for travel eSIMs only', async () => {
    const { service, findManyWithPagination } = buildService();

    await service.findPlansByRegion('dong-nam-a');

    expect(
      findManyWithPagination.mock.calls[0][0].filterOptions.isDomesticEsim,
    ).toBe(false);
  });
});

describe('"Loại gói: Local" filter in the CMS (doitac-1410 #072)', () => {
  function filterSql(type: unknown) {
    const andWhere = jest.fn();
    const repo = Object.create(
      PlansRelationalRepository.prototype,
    ) as PlansRelationalRepository;
    (
      repo as unknown as {
        applyPlanTypeFilter: (qb: unknown, type: unknown) => void;
      }
    ).applyPlanTypeFilter({ andWhere }, type);
    return andWhere.mock.calls;
  }

  it('should read "local" as the eSIM nội địa flag', () => {
    expect(filterSql('local')).toEqual([['plan."isDomesticEsim" = true']]);
  });

  it('should combine "local" with the data kinds by OR', () => {
    expect(filterSql('daily,local')).toEqual([
      [
        '(plan."type" IN (:...planTypes) OR plan."isDomesticEsim" = true)',
        { planTypes: ['daily'] },
      ],
    ]);
  });

  it('should filter the data kinds as before', () => {
    expect(filterSql(['fixed', 'daily'])).toEqual([
      ['plan."type" IN (:...planTypes)', { planTypes: ['fixed', 'daily'] }],
    ]);
  });
});
