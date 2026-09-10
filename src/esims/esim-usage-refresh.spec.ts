import { EsimsService } from './esims.service';

/**
 * Usage numbers used to be fetched only when somebody opened an eSIM, so the
 * order screen showed whatever was written at purchase time — normally 0 used
 * and no activation date. A scheduled sweep is what makes those figures real.
 */
function makeService(due: Record<string, unknown>[]) {
  const updates: { id: unknown; payload: Record<string, unknown> }[] = [];

  const repository = {
    findDueForUsageRefresh: jest.fn().mockResolvedValue(due),
    update: jest.fn((id: unknown, payload: Record<string, unknown>) => {
      updates.push({ id, payload });
      return Promise.resolve(payload);
    }),
  };

  const service = new EsimsService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, repository, updates };
}

describe('Scheduled eSIM usage refresh', () => {
  it('should only poll providers that actually expose a usage API', async () => {
    const { service, repository } = makeService([]);

    await service.refreshActiveEsimUsage();

    const [providers, limit] = repository.findDueForUsageRefresh.mock.calls[0];
    // Viettel / local inventory comes from a spreadsheet; there is nothing to poll.
    expect(providers).not.toContain('viettel');
    expect(providers).toEqual(
      expect.arrayContaining(['airalo', 'esimaccess', 'billion', 'microesim']),
    );
    // Capped so one sweep cannot hammer the provider APIs.
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(200);
  });

  it('should keep going when one eSIM fails', async () => {
    const { service } = makeService([
      { id: 1, provider: 'airalo', iccid: 'a' },
      { id: 2, provider: 'airalo', iccid: 'b' },
      { id: 3, provider: 'airalo', iccid: 'c' },
    ]);

    const seen: unknown[] = [];
    jest
      .spyOn(service, 'getDataUsage')
      .mockImplementation((esim: { id: unknown }) => {
        seen.push(esim.id);
        if (esim.id === 2) return Promise.reject(new Error('provider down'));
        return Promise.resolve({} as never);
      });

    await expect(service.refreshActiveEsimUsage()).resolves.toBeUndefined();

    // The failure of #2 must not abort #3.
    expect(seen).toEqual([1, 2, 3]);
  });

  it('should do nothing when no eSIM is due', async () => {
    const { service } = makeService([]);
    const spy = jest.spyOn(service, 'getDataUsage');

    await service.refreshActiveEsimUsage();

    expect(spy).not.toHaveBeenCalled();
  });
});
