import { PlansService } from './plans.service';
import {
  FULL_SYNC_HISTORY_SIZE,
  INTERRUPTED_RUN,
  SyncOrchestratorService,
} from '../esim-providers/sync-orchestrator.service';

/**
 * vande #078: while the 6-hourly sync ran, every plan it had written sat at
 * its bare cost until a margin pass at the very end — and customers bought at
 * cost. A plan is now priced the moment it is written, and an order never
 * charges a plan still at cost.
 */
type Row = {
  id: number;
  costPrice: number;
  price: number;
  isActive: boolean;
  isLocalInventory: boolean;
};

function buildPlans(initial: Row[]) {
  const rows = new Map(initial.map((r) => [r.id, { ...r }]));
  // What the shop could have read after every write, in order.
  const seen: { id: number; price: number; isActive: boolean }[] = [];
  const snapshot = () =>
    rows.forEach((r) =>
      seen.push({ id: r.id, price: r.price, isActive: r.isActive }),
    );
  let nextId = 100;
  const repo = {
    findById: jest.fn((id: number) => {
      const r = rows.get(Number(id));
      return Promise.resolve(r ? { ...r } : null);
    }),
    findBySlug: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: Partial<Row>) => {
      const row = { ...(data as Row), id: nextId++ };
      rows.set(row.id, row);
      snapshot();
      return Promise.resolve({ ...row });
    }),
    update: jest.fn((id: number, data: Partial<Row>) => {
      const row = rows.get(Number(id))!;
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) (row as Record<string, unknown>)[k] = v;
      }
      snapshot();
      return Promise.resolve({ ...row });
    }),
    // Margin tier: +100% on everything.
    recalculatePricesByTiers: jest.fn(
      (_t: unknown, _r: number, ids?: number[]) => {
        for (const id of ids ?? [...rows.keys()]) {
          const row = rows.get(Number(id))!;
          row.price = Math.round(row.costPrice * 2 * 100) / 100;
        }
        snapshot();
        return Promise.resolve();
      },
    ),
    updateAllVndPrices: jest.fn().mockResolvedValue(undefined),
    setActive: jest.fn((ids: number[], isActive: boolean) => {
      for (const id of ids) rows.get(Number(id))!.isActive = isActive;
      snapshot();
      return Promise.resolve();
    }),
  };
  const margins = {
    findAllTiers: jest
      .fn()
      .mockResolvedValue([
        { minVnd: 0, maxVnd: 1e12, percentage: 100, fixedAmountVnd: 0 },
      ]),
    calculateRetailVndFromLocalCost: jest.fn(),
  };
  const rate = { getUsdToVndRate: jest.fn().mockResolvedValue(26000) };
  const service = new PlansService(
    repo as never,
    {} as never,
    {} as never,
    margins as never,
    rate as never,
    {} as never,
  );
  // Neither the standard name nor the money conversion is under test here.
  const loose = service as unknown as Record<string, unknown>;
  loose.withStandardName = (plan: unknown) => plan;
  loose.convertPlanMoney = () =>
    Promise.resolve({
      price: { usd: 0, vnd: 0 },
      costPrice: { usd: 0, vnd: 0 },
      retailPrice: { usd: 0, vnd: 0 },
    });
  return { service, repo, rows, seen };
}

const synced = (cost: number, extra: object = {}) =>
  ({
    provider: 'esimaccess',
    providerPlanId: 'P1',
    name: 'United States 100MB / 7day',
    slug: 'us-100mb-7d',
    durationDays: 7,
    dataMb: 100,
    costPrice: cost,
    price: cost, // what the syncs pass: the bare cost
    retailPrice: 1,
    currency: 'USD',
    isActive: true,
    ...extra,
  }) as never;

describe('PlansService.saveSyncedPlan (vande #078)', () => {
  it('should never show an existing plan at its new cost while the sync writes it', async () => {
    const { service, rows, seen } = buildPlans([
      {
        id: 1,
        costPrice: 0.3,
        price: 0.6,
        isActive: true,
        isLocalInventory: false,
      },
    ]);

    await service.saveSyncedPlan(1, synced(0.35));
    await service.flushSyncedPlans();

    expect(rows.get(1)!.price).toBeCloseTo(0.7);
    // At no point did the row read as a cost (0.30 or 0.35).
    for (const s of seen.filter((row) => row.id === 1)) {
      expect(s.price).toBeGreaterThan(0.35);
    }
  });

  it('should keep a new plan off sale until it has its sale price', async () => {
    const { service, rows, seen } = buildPlans([]);

    const plan = await service.saveSyncedPlan(null, synced(0.3));
    await service.flushSyncedPlans();

    expect(rows.get(Number(plan!.id))).toMatchObject({
      price: 0.6,
      isActive: true,
    });
    for (const s of seen) {
      if (s.isActive) expect(s.price).toBeCloseTo(0.6);
    }
  });

  it('should leave a new plan off sale when the sync says so', async () => {
    const { service, rows } = buildPlans([]);

    const plan = await service.saveSyncedPlan(
      null,
      synced(0.3, { isActive: false }),
    );
    await service.flushSyncedPlans();

    expect(rows.get(Number(plan!.id))!.isActive).toBe(false);
  });
});

describe('PlansService.saveSyncedPlan batching (vande #078)', () => {
  it('should price plans in batches, not one statement per plan', async () => {
    const { service, repo } = buildPlans([]);
    for (let i = 0; i < 450; i++) {
      await service.saveSyncedPlan(null, synced(0.3, { slug: `p-${i}` }));
    }
    // Two full batches went at once; the last 50 wait for the flush.
    expect(repo.recalculatePricesByTiers).toHaveBeenCalledTimes(2);
    await service.flushSyncedPlans();
    expect(repo.recalculatePricesByTiers).toHaveBeenCalledTimes(3);
    expect(repo.setActive).toHaveBeenCalledTimes(3);
  });
});

describe('PlansService.findForSale (vande #078)', () => {
  it('should reprice a supplier plan still at cost before an order charges it', async () => {
    const { service, repo } = buildPlans([
      {
        id: 7,
        costPrice: 0.3,
        price: 0.3,
        isActive: true,
        isLocalInventory: false,
      },
    ]);

    const plan = await service.findForSale(7);

    expect(plan!.price).toBeCloseTo(0.6);
    expect(repo.recalculatePricesByTiers).toHaveBeenCalledWith(
      expect.anything(),
      26000,
      [7],
    );
  });

  it('should not touch a plan already above cost, nor local stock', async () => {
    const { service, repo } = buildPlans([
      {
        id: 8,
        costPrice: 0.3,
        price: 0.6,
        isActive: true,
        isLocalInventory: false,
      },
      {
        id: 9,
        costPrice: 50000,
        price: 50000,
        isActive: true,
        isLocalInventory: true,
      },
    ]);

    expect((await service.findForSale(8))!.price).toBe(0.6);
    expect((await service.findForSale(9))!.price).toBe(50000);
    expect(repo.recalculatePricesByTiers).not.toHaveBeenCalled();
  });
});

describe('SyncOrchestratorService history (vande #078)', () => {
  function build(rows: object[] = []) {
    const runs = {
      create: jest.fn((row: object) => row),
      save: jest.fn((row: object) => Promise.resolve({ id: 42, ...row })),
      update: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(rows),
    };
    const ok = { syncPlans: jest.fn().mockResolvedValue(undefined) };
    const plans = {
      updateVndPrices: jest.fn(),
      markCheapestPlans: jest.fn(),
      refreshProviders: jest.fn(),
      refreshStandardNames: jest.fn(),
      flushSyncedPlans: jest.fn(),
    };
    const service = new SyncOrchestratorService(
      ok as never,
      ok as never,
      ok as never,
      ok as never,
      plans as never,
      { recalculateAllPlanPrices: jest.fn() } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      runs as never,
    );
    return { service, runs };
  }

  it('should record who started a run, when it ended, and keep only the latest runs', async () => {
    const { service, runs } = build();

    await service.runFullSync('manual', 5);

    expect(runs.save).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'manual', adminId: 5 }),
    );
    expect(runs.update).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ finishedAt: expect.any(Date), errors: [] }),
    );
    const trim = runs.query.mock.calls.find(([sql]) =>
      String(sql).trim().startsWith('DELETE'),
    );
    expect(trim?.[1]).toEqual([FULL_SYNC_HISTORY_SIZE]);
  });

  it('should close a run the server restarted in the middle of', async () => {
    const { service, runs } = build();

    await service.onModuleInit();

    const [sql, params] = runs.query.mock.calls[0];
    expect(String(sql)).toContain('"finishedAt" IS NULL');
    expect(JSON.parse(params[0])).toEqual([INTERRUPTED_RUN]);
  });

  it('should list runs with their duration and who ran them', async () => {
    const { service } = build([
      {
        id: 2,
        trigger: 'manual',
        adminId: 5,
        startedAt: '2026-10-27T01:00:00Z',
        finishedAt: '2026-10-27T01:25:30Z',
        errors: [],
        firstName: 'Thọ',
        lastName: 'Nguyễn',
        email: 'x@example.com',
      },
      {
        id: 1,
        trigger: 'cron',
        adminId: null,
        startedAt: '2026-10-26T19:00:00Z',
        finishedAt: null,
        errors: [],
        firstName: null,
        lastName: null,
        email: null,
      },
    ]);

    const history = await service.getHistory();

    expect(history[0]).toMatchObject({
      durationSeconds: 1530,
      startedBy: 'Thọ Nguyễn',
    });
    expect(history[1]).toMatchObject({
      durationSeconds: null,
      startedBy: 'Hệ thống',
    });
  });
});
