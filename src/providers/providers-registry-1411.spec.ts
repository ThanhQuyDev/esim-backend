import { ConflictException } from '@nestjs/common';
import { ProvidersService } from './providers.service';

/**
 * vande-1411 #024 — "Danh sách Nhà cung cấp": a name and an overview code per
 * supplier, a domestic supplier added by hand, and no delete that would orphan
 * a plan, an eSIM or an order.
 */
describe('Danh sách Nhà cung cấp (vande-1411 #024)', () => {
  type Row = Record<string, unknown> & { provider: string };

  function setup(
    rows: Row[],
    plans: { provider: string; total: number }[] = [],
    esims: { provider: string; esims: number }[] = [],
  ) {
    const saved: Row[] = [];
    const deleted: unknown[] = [];
    const repository = {
      find: jest.fn().mockImplementation(() => Promise.resolve(rows)),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data: Row) => {
        saved.push(data);
        const at = rows.findIndex((r) => r.provider === data.provider);
        if (at >= 0) rows[at] = { ...rows[at], ...data };
        else rows.push(data);
        return Promise.resolve(data);
      }),
      delete: jest.fn().mockImplementation((where) => {
        deleted.push(where);
        return Promise.resolve();
      }),
      manager: {
        query: jest
          .fn()
          .mockImplementation((sql: string) =>
            Promise.resolve(
              sql.includes('"esim"')
                ? esims
                : plans.map((p) => ({ ...p, active: p.total, disabled: 0 })),
            ),
          ),
      },
    };
    const service = new ProvidersService(repository as never, {} as never);
    return { service, saved, deleted };
  }

  it('should list a name, a code and whether it can go', async () => {
    const { service } = setup(
      [
        {
          provider: 'billion',
          isEnabled: true,
          displayName: 'Billion Connect',
          shortCode: 'BL',
        },
      ],
      [{ provider: 'billion', total: 12 }],
    );
    const billion = (await service.list()).find(
      (p) => p.provider === 'billion',
    )!;
    expect(billion).toMatchObject({
      displayName: 'Billion Connect',
      shortCode: 'BL',
      isApi: true,
      isManual: false,
      planCount: 12,
    });
  });

  it('should add a domestic supplier under "<carrier>-noidia"', async () => {
    const { service, saved } = setup([]);
    const row = await service.create({
      displayName: 'Vietnamobile',
      provider: 'vietnamobile',
      shortCode: 'vnm-nd',
    });
    expect(saved[0]).toMatchObject({
      provider: 'vietnamobile-noidia',
      displayName: 'Vietnamobile',
      shortCode: 'VNM-ND',
      isManual: true,
      isEnabled: true,
    });
    expect(row.provider).toBe('vietnamobile-noidia');
  });

  it('should refuse a supplier that already exists', async () => {
    const { service } = setup([{ provider: 'itel-noidia', isEnabled: true }]);
    await expect(
      service.create({
        displayName: 'iTel',
        provider: 'itel',
        shortCode: 'IT',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should not delete a supplier with an API or one it did not add', async () => {
    const { service, deleted } = setup([
      { provider: 'billion', isEnabled: true },
      { provider: 'itel-noidia', isEnabled: true, isManual: false },
    ]);
    await expect(service.remove('billion')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.remove('itel-noidia')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(deleted).toHaveLength(0);
  });

  it('should not delete one with plans or eSIMs, sold or in stock', async () => {
    const { service, deleted } = setup(
      [
        { provider: 'a-noidia', isEnabled: true, isManual: true },
        { provider: 'b-noidia', isEnabled: true, isManual: true },
      ],
      [{ provider: 'a-noidia', total: 1 }],
      [{ provider: 'b-noidia', esims: 3 }],
    );
    await expect(service.remove('a-noidia')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.remove('b-noidia')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(deleted).toHaveLength(0);
  });

  it('should delete one added by hand that nothing hangs off', async () => {
    const { service, deleted } = setup([
      { provider: 'vietnamobile-noidia', isEnabled: true, isManual: true },
    ]);
    await service.remove('vietnamobile-noidia');
    expect(deleted).toEqual([{ provider: 'vietnamobile-noidia' }]);
  });

  it('should rename without touching the switch', async () => {
    const { service, saved } = setup([
      { provider: 'billion', isEnabled: false, disabledReason: 'API lỗi' },
    ]);
    await service.update('billion', {
      displayName: 'Billion',
      shortCode: 'bl',
    });
    expect(saved[0]).toEqual({
      provider: 'billion',
      displayName: 'Billion',
      shortCode: 'BL',
    });
  });
});
