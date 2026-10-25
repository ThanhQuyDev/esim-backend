import { RegionsService } from './regions.service';
import { RegionEntity } from './infrastructure/persistence/relational/entities/region.entity';
import { RegionsRelationalRepository } from './infrastructure/persistence/relational/repositories/region.repository';

/**
 * vande #035 — "Khu vực cha": the admin picks which region's page lists this
 * one as another pack. One level deep.
 */
describe('region parent (vande #035)', () => {
  const regions: Record<number, { id: number; parentId: number | null }> = {
    1: { id: 1, parentId: null }, // Châu Á
    2: { id: 2, parentId: 1 }, // Châu Á 13 quốc gia
    3: { id: 3, parentId: null }, // Đông Nam Á
  };
  const repo = {
    findBySlug: jest.fn().mockResolvedValue(null),
    findById: jest.fn((id: number) => Promise.resolve(regions[id] ?? null)),
    hasChildren: jest.fn((id: number) =>
      Promise.resolve(Object.values(regions).some((r) => r.parentId === id)),
    ),
    update: jest.fn((id: number, payload: object) =>
      Promise.resolve({ id, ...payload }),
    ),
  };
  const service = new RegionsService(repo as never);

  it('should save the chosen parent', async () => {
    await service.update(3, { parentId: 1 });
    expect(repo.update).toHaveBeenLastCalledWith(
      3,
      expect.objectContaining({ parentId: 1 }),
      undefined,
    );
  });

  it.each([
    [3, 3, 'parentIsSelf'],
    [3, 99, 'parentNotFound'],
    [3, 2, 'parentHasParent'],
    [1, 3, 'regionHasChildren'],
  ])('should refuse region %s under %s (%s)', async (id, parentId, reason) => {
    await expect(service.update(id, { parentId })).rejects.toMatchObject({
      response: { errors: { parentId: reason } },
    });
  });

  it('should let a region leave its parent', async () => {
    await service.update(2, { parentId: null });
    expect(repo.update).toHaveBeenLastCalledWith(
      2,
      expect.objectContaining({ parentId: null }),
      undefined,
    );
  });

  it('should keep the parent when an update does not send it', async () => {
    const stored = Object.assign(new RegionEntity(), {
      id: 2,
      name: 'Asia 13',
      slug: 'esim-chau-a-13-quoc-gia',
      parentId: 1,
      notice: '<p>Ghi chú</p>',
    });
    const typeorm = {
      findOne: jest.fn().mockResolvedValue(stored),
      create: jest.fn((e: RegionEntity) => e),
      save: jest.fn((e: RegionEntity) => Promise.resolve(e)),
    };
    const relational = new RegionsRelationalRepository(
      typeorm as never,
      {} as never,
    );

    const updated = await relational.update(2, {
      name: 'Asia 13 countries',
      parentId: undefined,
      notice: undefined,
    });

    expect(updated.parentId).toBe(1);
    expect(updated.notice).toBe('<p>Ghi chú</p>');
  });
});
