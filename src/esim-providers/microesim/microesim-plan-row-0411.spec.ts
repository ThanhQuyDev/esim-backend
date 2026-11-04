import { MicroEsimService } from './microesim.service';

/** vande-0411 #034 — a plan on sale keeps its own row. */
describe('MicroEsim plan row (vande-0411 #034)', () => {
  function service(own: unknown, bySlug: unknown) {
    const svc = Object.create(MicroEsimService.prototype) as never as {
      existingPlanFor(item: unknown, slug: string): Promise<unknown>;
    };
    Object.assign(svc, {
      liveDataplanIds: new Set(['A1', 'A2']),
      plansService: {
        findByProviderPlanId: jest.fn().mockResolvedValue(own),
        findBySlug: jest.fn().mockResolvedValue(bySlug),
      },
    });
    return svc;
  }
  const item = { channel_dataplan_id: 'A2' };

  it('should use its own row first', async () => {
    const own = { id: 2, providerPlanId: 'A2' };
    const other = { id: 1, providerPlanId: 'A1' };

    await expect(
      service(own, other).existingPlanFor(item, 'slug'),
    ).resolves.toBe(own);
  });

  it('should not take the row of another plan on sale', async () => {
    const other = { id: 1, providerPlanId: 'A1' };

    await expect(
      service(null, other).existingPlanFor(item, 'slug'),
    ).resolves.toBeNull();
  });

  it('should take over a row an older mapping left', async () => {
    const old = { id: 3, providerPlanId: 'GONE' };

    await expect(
      service(null, old).existingPlanFor(item, 'slug'),
    ).resolves.toBe(old);
  });
});
