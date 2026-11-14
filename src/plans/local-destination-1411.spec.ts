import { NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { localProviderOf } from '../destinations/destinations.service';

/**
 * vande-1411 #025 — a destination of eSIM Type "Local" names a domestic
 * supplier; its carrier's button and page take the destination's title,
 * picture, icon and description, and the button stands before any eSIM is
 * imported.
 */
describe('Điểm đến eSIM Type Local (vande-1411 #025)', () => {
  const VIETNAMOBILE = {
    id: 90,
    name: 'Vietnamobile',
    title: 'Vietnamobile',
    titleVi: 'Vietnamobile',
    description: 'P1 EN',
    descriptionVi: 'P1 VI',
    avatarUrl: 'https://img/avatar.png',
    flagUrl: 'https://img/icon.png',
    parentId: 5,
    esimType: 'local',
    localProvider: 'vietnamobile-noidia',
  };

  function service(
    carriers: unknown[],
    destinations: unknown[],
    plans: unknown[] = [],
  ) {
    const s = Object.create(PlansService.prototype) as PlansService;
    const findMany = jest
      .fn()
      .mockResolvedValue([destinations, destinations.length]);
    Object.assign(s as unknown as Record<string, unknown>, {
      plansRepository: {
        getLocalCarriers: jest.fn().mockResolvedValue(carriers),
        findManyWithPagination: jest
          .fn()
          .mockResolvedValue([plans, plans.length]),
      },
      destinationsService: {
        findManyWithPagination: findMany,
        findById: jest.fn().mockResolvedValue({
          id: 5,
          name: 'Vietnam',
          title: 'Vietnam eSIM',
          titleVi: 'eSIM Việt Nam',
          slug: 'esim-vietnam',
          slugVi: 'esim-viet-nam',
          countryCode: 'VN',
          flagUrl: 'https://img/vn.png',
        }),
      },
    });
    return { s, findMany };
  }

  it('should store a local destination under "<carrier>-noidia", a travel one under none', () => {
    expect(localProviderOf('local', 'vietnamobile')).toBe(
      'vietnamobile-noidia',
    );
    expect(localProviderOf('local', 'itel-noidia')).toBe('itel-noidia');
    expect(localProviderOf('travel', 'vietnamobile')).toBeNull();
    expect(localProviderOf('local', '  ')).toBeNull();
  });

  it('should give a carrier its local destination, and add one with no eSIM yet', async () => {
    const { s, findMany } = service(
      [{ provider: 'itel-noidia', fromVndPrice: 47000, planCount: 3 }],
      [VIETNAMOBILE],
    );
    const list = await s.listLocalCarriers();
    expect(findMany.mock.calls[0][0].filterOptions).toEqual({
      esimType: 'local',
      isActive: true,
    });
    expect(
      list.find((c) => c.provider === 'itel-noidia')?.destination,
    ).toBeNull();
    const vnm = list.find((c) => c.provider === 'vietnamobile-noidia');
    expect(vnm).toMatchObject({
      carrier: 'vietnamobile',
      planCount: 0,
      fromVndPrice: 0,
    });
    expect(vnm?.destination).toMatchObject({
      title: 'Vietnamobile',
      descriptionVi: 'P1 VI',
      avatarUrl: 'https://img/avatar.png',
      flagUrl: 'https://img/icon.png',
      parentId: 5,
    });
    // vande-1411 #026: its parent, for the search to suggest with it.
    expect(vnm?.destination?.parent).toMatchObject({
      id: 5,
      slugVi: 'esim-viet-nam',
      countryCode: 'VN',
    });
  });

  it('should open an empty page for a local destination before its import, and 404 any other', async () => {
    const { s } = service([], [VIETNAMOBILE]);
    const groups = await s.findLocalPlansByCarrier('vietnamobile');
    expect(
      Object.values(groups).every((g) => Array.isArray(g) && g.length === 0),
    ).toBe(true);
    await expect(s.findLocalPlansByCarrier('mobifone')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
