import { EsimsService, type DataUsageResult } from './esims.service';

/**
 * Gadget Korea data usage on the customer's eSIM tab (#065).
 *
 * Their API does report usage — but it reports only what has been CONSUMED, plus
 * the activation and expiry times. Never the package size. The mapping passed
 * `total: 0` straight through, so the page drew an empty bar and said "0 GB",
 * which is why the data appeared not to show at all.
 *
 * The package size lives on the plan, and Gadget Korea is the one provider that
 * hands us a real activation timestamp — both are now used.
 */

function makeService(opts: {
  usage: { usage: string; activeTime: string; expireTime: string };
  planDataMb?: number | null;
  esim?: Record<string, unknown>;
}) {
  const service = Object.create(EsimsService.prototype) as EsimsService;
  const internals = service as unknown as Record<string, unknown>;
  const updates: Record<string, unknown>[] = [];

  const esim = {
    id: 1,
    provider: 'gadgetkorea',
    activatedAt: null,
    expiresAt: null,
    dataUsed: null,
    dataTotal: null,
    status: 'sold',
    ...opts.esim,
  };

  internals.esimsRepository = {
    findByIdWithRelations: jest.fn().mockResolvedValue({
      ...esim,
      orderItem: { orderRequestId: 'topup-1' },
      plan:
        opts.planDataMb === null ? null : { dataMb: opts.planDataMb ?? 3072 },
    }),
    update: jest.fn((_id: unknown, patch: Record<string, unknown>) => {
      updates.push(patch);
      return Promise.resolve(esim);
    }),
  };
  internals.gadgetKoreaService = {
    getDataUsage: jest.fn().mockResolvedValue(opts.usage),
  };

  const run = (): Promise<DataUsageResult> =>
    (
      service as unknown as {
        fetchProviderUsage: (e: unknown) => Promise<DataUsageResult>;
      }
    ).fetchProviderUsage(esim);

  return { run, updates };
}

const USAGE = {
  usage: '512',
  activeTime: '2026-01-10T03:00:00.000Z',
  expireTime: '2026-02-09T03:00:00.000Z',
};

describe('Gadget Korea usage', () => {
  it('should take the package size from the plan, since the API never sends it', async () => {
    const { run } = makeService({ usage: USAGE, planDataMb: 3072 });

    const result = await run();

    expect(result.total).toBe(3072);
    expect(result.dataUsed).toBe(512);
    // Without this the page showed an empty bar and "0 GB left".
    expect(result.remaining).toBe(2560);
  });

  it('should keep the activation time the provider reports', async () => {
    const { run, updates } = makeService({ usage: USAGE });

    const result = await run();

    expect(result.activatedAt).toBe(USAGE.activeTime);
    expect(result.expiredAt).toBe(USAGE.expireTime);
    // …and record it, rather than stamping "now" on the first poll.
    expect(updates[0].activatedAt).toEqual(new Date(USAGE.activeTime));
  });

  it('should report an eSIM with no activation time as not activated', async () => {
    const { run, updates } = makeService({
      usage: { ...USAGE, activeTime: '' },
    });

    const result = await run();

    // The wording every other provider uses, and the one the page translates.
    expect(result.status).toBe('NOT_ACTIVE');
    expect(result.activatedAt).toBeNull();
    expect(updates[0].activatedAt).toBeUndefined();
  });

  it('should not invent a remaining figure when the plan size is unknown', async () => {
    const { run } = makeService({ usage: USAGE, planDataMb: null });

    const result = await run();

    expect(result.total).toBe(0);
    // Null, not "0 left" — the page then shows what has been used instead.
    expect(result.remaining).toBeNull();
    expect(result.dataUsed).toBe(512);
  });

  it('should never report more used than the package holds', async () => {
    const { run } = makeService({
      usage: { ...USAGE, usage: '5000' },
      planDataMb: 3072,
    });

    const result = await run();

    expect(result.remaining).toBe(0);
  });
});
