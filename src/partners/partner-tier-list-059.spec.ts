import { ConflictException } from '@nestjs/common';
import { PartnersService } from './partners.service';

/**
 * "Hạng đối tác" as a list (doitac-1410 #059, #060): every tier with its
 * partner count, one "Hạng mặc định" per type that new partners start on, and
 * a tier code that can be changed — with the partners on it following.
 */

function buildService(opts: {
  tier?: Record<string, unknown> | null;
  taken?: boolean;
  tiers?: Record<string, unknown>[];
  counts?: Record<string, unknown>[];
}) {
  const managerQuery = jest.fn().mockResolvedValue([]);
  const query = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('LOWER("tierCode")')) {
      return Promise.resolve(opts.taken ? [{ id: 99 }] : []);
    }
    if (sql.includes('GROUP BY 1, 2'))
      return Promise.resolve(opts.counts ?? []);
    return Promise.resolve([]);
  });
  const tierRepository = {
    findOne: jest.fn().mockResolvedValue(opts.tier ?? null),
    find: jest.fn().mockResolvedValue(opts.tiers ?? []),
    save: jest.fn().mockImplementation((t) => Promise.resolve({ id: 5, ...t })),
    create: jest.fn().mockImplementation((t) => t),
  };
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    tierRepository,
    dataSource: {
      query,
      transaction: (fn: (m: unknown) => Promise<unknown>) =>
        fn({ query: managerQuery }),
    },
  });
  return { service, query, managerQuery, tierRepository };
}

const TIER = {
  id: 4,
  partnerType: 'kol',
  tierCode: 'SILVEL',
  tierName: 'Bạc',
  isActive: true,
  isDefault: false,
};

describe('PartnersService.updateTier — tier code (doitac-1410 #059)', () => {
  it('should move the partners on the tier to the new code', async () => {
    const { service, managerQuery } = buildService({ tier: { ...TIER } });

    const saved = await service.updateTier(4, { tierCode: 'SILVER' });

    expect(saved.tierCode).toBe('SILVER');
    const sqls = managerQuery.mock.calls.map(([q, p]) => [q as string, p]);
    const moved = sqls.find(([q]) => q.includes('UPDATE partner SET'));
    expect(moved?.[1]).toEqual(['SILVER', 'kol', 'SILVEL']);
  });

  it('should refuse a code another tier of the type already has', async () => {
    const { service } = buildService({ tier: { ...TIER }, taken: true });

    await expect(
      service.updateTier(4, { tierCode: 'GOLD' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should leave the partners alone when the code is unchanged', async () => {
    const { service, managerQuery } = buildService({ tier: { ...TIER } });

    await service.updateTier(4, { tierCode: 'SILVEL', tierName: 'Bạc mới' });

    expect(managerQuery).not.toHaveBeenCalled();
  });
});

describe('Hạng mặc định (doitac-1410 #059, #060)', () => {
  it('should keep only one default tier per partner type', async () => {
    const { service, managerQuery } = buildService({ tier: { ...TIER } });

    const saved = await service.updateTier(4, { isDefault: true });

    expect(saved.isDefault).toBe(true);
    const [unset] = managerQuery.mock.calls[0] as [string, unknown[]];
    expect(unset).toContain('SET "isDefault" = false');
  });

  it('should not let an inactive tier be the default', async () => {
    const { service, managerQuery } = buildService({
      tier: { ...TIER, isDefault: true },
    });

    const saved = await service.updateTier(4, {
      isActive: false,
      isDefault: true,
    });

    expect(saved.isDefault).toBe(false);
    expect(managerQuery).not.toHaveBeenCalled();
  });

  it('should hand a new partner the active default tier of their type', async () => {
    const { service, tierRepository } = buildService({
      tier: { ...TIER, isDefault: true },
    });

    await expect(service.defaultTierCode('kol')).resolves.toBe('SILVEL');
    expect(tierRepository.findOne).toHaveBeenCalledWith({
      where: { partnerType: 'kol', isDefault: true, isActive: true },
    });
  });

  it('should leave a new partner without a tier when none is the default', async () => {
    const { service } = buildService({ tier: null });

    await expect(service.defaultTierCode('distribution')).resolves.toBeNull();
  });
});

describe('PartnersService.adminListTiers (doitac-1410 #059, #060)', () => {
  it('should count the partners on each tier, inactive tiers included', async () => {
    const { service, tierRepository } = buildService({
      tiers: [
        { ...TIER },
        { ...TIER, id: 9, partnerType: 'distribution', isActive: false },
      ],
      counts: [
        { partnerType: 'kol', tierCode: 'SILVEL', n: 3 },
        { partnerType: 'distribution', tierCode: 'BRONZE', n: 2 },
      ],
    });

    const tiers = await service.adminListTiers();

    expect(tierRepository.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ where: expect.anything() }),
    );
    expect(tiers.map((t) => t.partnerCount)).toEqual([3, 0]);
  });
});
