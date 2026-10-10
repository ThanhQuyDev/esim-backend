import { OverviewService } from './overview.service';

/**
 * #063 (test round 4) — an order placed on a customer's behalf for a domestic
 * itel eSIM never reached the overview: its supplier was not on the fixed list.
 */
describe('Overview suppliers (#063)', () => {
  const make = (query: jest.Mock) =>
    new OverviewService(
      {} as never,
      { manager: { query } } as never,
      {} as never,
      {} as never,
    ) as unknown as { overviewProviders(): Promise<string[]> };

  it('should add every supplier that has plans to the known ones', async () => {
    const service = make(
      jest
        .fn()
        .mockResolvedValue([{ provider: 'itel' }, { provider: 'airalo' }]),
    );
    const providers = await service.overviewProviders();
    expect(providers).toContain('itel');
    expect(providers.filter((p) => p === 'airalo')).toHaveLength(1);
    expect(providers.slice(0, 2)).toEqual(['airalo', 'esimaccess']);
  });

  it('should fall back to the known suppliers when the lookup fails', async () => {
    const service = make(jest.fn().mockRejectedValue(new Error('db down')));
    expect(await service.overviewProviders()).toContain('billion');
  });
});
