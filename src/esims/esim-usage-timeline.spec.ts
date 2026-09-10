import { EsimsService, type DataUsageResult } from './esims.service';

/**
 * Usage timeline on the customer's eSIM tab (#062).
 *
 * The page could never show time remaining because eSIM Access — the provider
 * behind most orders — returns data usage and nothing else: no expiry, no
 * activation date. So "days left" printed "—" for good.
 *
 * The fix reads the activation moment the usage cron records and derives the
 * expiry from the plan length, because the plan's clock starts when the eSIM
 * first connects to a network, not when it was bought.
 */

const BASE_USAGE: DataUsageResult = {
  remaining: 2048,
  total: 3072,
  dataUsed: 1024,
  expiredAt: null,
  isUnlimited: false,
  status: 'ACTIVE',
  lastUpdateTime: null,
};

function makeService(stored: Record<string, unknown> | null) {
  const service = Object.create(EsimsService.prototype) as EsimsService;
  (service as unknown as Record<string, unknown>).esimsRepository = {
    findByIdWithRelations: jest.fn().mockResolvedValue(stored),
  };

  const withTimeline = (
    esim: Record<string, unknown>,
    usage: DataUsageResult,
  ): Promise<DataUsageResult> =>
    (
      service as unknown as {
        withTimeline: (
          e: unknown,
          u: DataUsageResult,
        ) => Promise<DataUsageResult>;
      }
    ).withTimeline(esim, usage);

  return { withTimeline };
}

const ACTIVATED = new Date('2026-01-10T03:00:00.000Z');

describe('Deriving the usage timeline', () => {
  it('should end the plan a duration after it was activated', async () => {
    const { withTimeline } = makeService({
      id: 1,
      activatedAt: ACTIVATED,
      expiresAt: null,
      plan: { durationDays: 30 },
    });

    const result = await withTimeline({ id: 1 }, BASE_USAGE);

    // 10 Jan + 30 days — the provider gave no expiry at all.
    expect(result.expiredAt).toBe('2026-02-09T03:00:00.000Z');
    expect(result.activatedAt).toBe(ACTIVATED.toISOString());
    expect(result.durationDays).toBe(30);
  });

  it('should keep an expiry the provider did give', async () => {
    const providerExpiry = '2026-03-01T00:00:00.000Z';
    const { withTimeline } = makeService({
      id: 1,
      activatedAt: ACTIVATED,
      expiresAt: null,
      plan: { durationDays: 30 },
    });

    const result = await withTimeline(
      { id: 1 },
      { ...BASE_USAGE, expiredAt: providerExpiry },
    );

    // Airalo reports a real expiry; it must win over anything we compute.
    expect(result.expiredAt).toBe(providerExpiry);
  });

  it('should fall back to the expiry already stored by the cron', async () => {
    const stored = new Date('2026-02-20T00:00:00.000Z');
    const { withTimeline } = makeService({
      id: 1,
      activatedAt: ACTIVATED,
      expiresAt: stored,
      plan: { durationDays: 30 },
    });

    const result = await withTimeline({ id: 1 }, BASE_USAGE);

    expect(result.expiredAt).toBe(stored.toISOString());
  });

  it('should give no dates at all for an eSIM that was never activated', async () => {
    const { withTimeline } = makeService({
      id: 1,
      activatedAt: null,
      expiresAt: null,
      plan: { durationDays: 30 },
    });

    const result = await withTimeline({ id: 1 }, BASE_USAGE);

    // A countdown that has not started must not be invented — the page says
    // "chưa kích hoạt" instead.
    expect(result.activatedAt).toBeNull();
    expect(result.expiredAt).toBeNull();
    // The plan length is still useful: it is what the bar will be drawn against.
    expect(result.durationDays).toBe(30);
  });

  it('should not invent an expiry when the plan length is unknown', async () => {
    const { withTimeline } = makeService({
      id: 1,
      activatedAt: ACTIVATED,
      expiresAt: null,
      plan: null,
    });

    const result = await withTimeline({ id: 1 }, BASE_USAGE);

    expect(result.expiredAt).toBeNull();
    expect(result.durationDays).toBeNull();
  });

  it('should leave the data figures untouched', async () => {
    const { withTimeline } = makeService({
      id: 1,
      activatedAt: ACTIVATED,
      expiresAt: null,
      plan: { durationDays: 7 },
    });

    const result = await withTimeline({ id: 1 }, BASE_USAGE);

    expect(result).toMatchObject({
      remaining: 2048,
      total: 3072,
      dataUsed: 1024,
      status: 'ACTIVE',
    });
  });

  it('should still answer when the eSIM row cannot be re-read', async () => {
    const { withTimeline } = makeService(null);

    const result = await withTimeline({ id: 1, activatedAt: null }, BASE_USAGE);

    expect(result.expiredAt).toBeNull();
    expect(result.durationDays).toBeNull();
  });
});
