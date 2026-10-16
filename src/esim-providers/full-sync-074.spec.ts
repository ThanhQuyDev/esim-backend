import { SyncOrchestratorService } from './sync-orchestrator.service';

/**
 * "Cập nhật lại toàn bộ sản phẩm" (doitac-1410 #074): the 6-hourly catalogue
 * sync on demand, one run at a time. No supplier is called — every one is a
 * mock.
 */
function buildService(
  opts: { airaloFails?: boolean; hold?: Promise<void> } = {},
) {
  const order: string[] = [];
  const step = (name: string, fail = false) =>
    jest.fn().mockImplementation(async () => {
      if (name === 'airalo' && opts.hold) await opts.hold;
      order.push(name);
      if (fail) throw new Error(`${name} down`);
    });
  const deps = {
    airalo: { syncPlans: step('airalo', opts.airaloFails) },
    esimAccess: { syncPlans: step('esimaccess') },
    microEsim: { syncPlans: step('microesim') },
    billion: { syncPlans: step('billion') },
    plans: {
      updateVndPrices: step('vnd'),
      markCheapestPlans: step('cheapest'),
      refreshProviders: step('refresh'),
    },
    margins: { recalculateAllPlanPrices: step('margins') },
  };
  const service = new SyncOrchestratorService(
    deps.airalo as never,
    deps.esimAccess as never,
    deps.microEsim as never,
    deps.billion as never,
    deps.plans as never,
    deps.margins as never,
  );
  return { service, order, deps };
}

describe('SyncOrchestratorService — manual full sync (doitac-1410 #074)', () => {
  it('should run every supplier, then prices and the cheapest flags', async () => {
    const { service, order } = buildService();

    await service.runFullSync('manual');

    expect(order).toEqual([
      'airalo',
      'esimaccess',
      'microesim',
      'billion',
      'margins',
      'vnd',
      'cheapest',
      'refresh',
    ]);
    expect(service.getStatus()).toMatchObject({
      running: false,
      trigger: 'manual',
      errors: [],
    });
    expect(service.getStatus().finishedAt).toBeInstanceOf(Date);
  });

  it('should carry on past a failing supplier and say which one failed', async () => {
    const { service, order } = buildService({ airaloFails: true });

    await service.runFullSync('manual');

    expect(order).toContain('cheapest');
    expect(service.getStatus().errors).toEqual(['Airalo: airalo down']);
  });

  it('should not start a second run while one is going', async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    const { service, deps } = buildService({ hold });

    const first = service.startManualSync();
    const second = service.startManualSync();
    // The scheduled run arriving meanwhile is skipped too.
    await service.runFullSync('cron');

    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    expect(second.status.running).toBe(true);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(deps.airalo.syncPlans).toHaveBeenCalledTimes(1);
    expect(service.getStatus().running).toBe(false);
  });
});
