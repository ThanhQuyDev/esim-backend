import { EsimsService, type DataUsageResult } from './esims.service';

/**
 * The customer's usage tab when the provider cannot be asked (#027).
 *
 * Viettel and other local inventory have no usage API, and some eSIMs lack the
 * ids a provider needs. Those used to answer 404, so the tab read "Không thể tải
 * dữ liệu sử dụng"; and the stored fallback reported the ORDER status ("sold")
 * as if it were a usage status, with "0 left" when the package size was unknown.
 */

function makeService(esim: Record<string, unknown>) {
  const service = Object.create(EsimsService.prototype) as EsimsService;
  const internals = service as unknown as Record<string, unknown>;

  internals.esimsRepository = {
    findByIdWithRelations: jest.fn().mockResolvedValue({
      ...esim,
      orderItem: null,
      plan: { dataMb: 5120, durationDays: 15 },
    }),
    update: jest.fn().mockResolvedValue(esim),
  };

  const fetch = (): Promise<DataUsageResult> =>
    (
      service as unknown as {
        fetchProviderUsage: (e: unknown) => Promise<DataUsageResult>;
      }
    ).fetchProviderUsage(esim);

  return { fetch };
}

const BASE = {
  id: 32,
  iccid: '8984',
  status: 'sold',
  activatedAt: null,
  expiresAt: null,
  dataUsed: null,
  dataTotal: '5120',
  esimTranNo: null,
};

describe('eSIM usage without a provider answer', () => {
  it('should not fail for a provider with no usage API, and say nothing is known', async () => {
    const { fetch } = makeService({ ...BASE, provider: 'viettel' });

    const result = await fetch();

    expect(result.usageAvailable).toBe(false);
    expect(result.status).toBe('NOT_ACTIVE');
  });

  it('should fall back instead of failing when an eSIM Access eSIM has no tran no', async () => {
    const { fetch } = makeService({
      ...BASE,
      provider: 'esimaccess',
      dataUsed: '256',
      activatedAt: new Date('2026-09-01T00:00:00Z'),
    });

    const result = await fetch();

    expect(result).toMatchObject({
      total: 5120,
      dataUsed: 256,
      remaining: 4864,
      status: 'ACTIVE',
      usageAvailable: true,
    });
  });

  it('should report an unknown remaining figure rather than 0 when the size is unknown', async () => {
    const { fetch } = makeService({
      ...BASE,
      provider: 'gadgetkorea',
      dataTotal: null,
      dataUsed: '512',
    });

    const result = await fetch();

    expect(result.remaining).toBeNull();
    expect(result.dataUsed).toBe(512);
  });

  it('should never pass the order status off as a usage status', async () => {
    const { fetch } = makeService({ ...BASE, provider: 'billion' });

    expect((await fetch()).status).not.toBe('sold');
  });
});
