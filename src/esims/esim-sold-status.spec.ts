import { EsimsService } from './esims.service';

/**
 * Only Viettel / local inventory is uploaded before anyone buys it, so only it
 * can legitimately sit `available`. Every API provider creates the eSIM at the
 * moment of purchase, and each of those integrations passed
 * `status: 'available'` — so the CMS listed sold eSIMs as unsold stock.
 *
 * The rule lives in EsimsService: an eSIM tied to an order item reads `sold`.
 */
function makeService(existing?: Record<string, unknown>) {
  const created: Record<string, unknown>[] = [];
  const updated: { id: unknown; payload: Record<string, unknown> }[] = [];

  const repository = {
    findByIccid: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(existing ?? null),
    create: jest.fn((payload: Record<string, unknown>) => {
      created.push(payload);
      return Promise.resolve(payload);
    }),
    update: jest.fn((id: unknown, payload: Record<string, unknown>) => {
      updated.push({ id, payload });
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

  return { service, created, updated };
}

describe('eSIM status when a supplier provisions on purchase', () => {
  it('should mark an eSIM created for an order item as sold', async () => {
    const { service, created } = makeService();

    await service.create({
      iccid: '8934079000000000001',
      status: 'available',
      orderItemId: 42,
      userId: 7,
    } as never);

    expect(created[0].status).toBe('sold');
  });

  it('should leave uploaded inventory as available', async () => {
    const { service, created } = makeService();

    // Viettel stock imported from Excel: nobody has bought it yet.
    await service.create({
      iccid: '8934079000000000002',
      status: 'available',
      orderItemId: null,
    } as never);

    expect(created[0].status).toBe('available');
  });

  it('should not knock a sold eSIM back to available on a provider callback', async () => {
    const { service, updated } = makeService({
      id: 1,
      status: 'sold',
      orderItemId: 42,
    });

    // Providers re-send `available` when they refresh the QR payload.
    await service.update(1 as never, { status: 'available' } as never);

    expect(updated[0].payload.status).toBe('sold');
  });

  it('should never resurrect a refunded eSIM', async () => {
    const { service, updated } = makeService({
      id: 2,
      status: 'refunded',
      orderItemId: 42,
    });

    await service.update(2 as never, { status: 'available' } as never);

    // undefined = field left untouched by the update.
    expect(updated[0].payload.status).toBeUndefined();
  });

  it('should still allow an admin to set a real status by hand', async () => {
    const { service, updated } = makeService({
      id: 3,
      status: 'sold',
      orderItemId: 42,
    });

    await service.update(3 as never, { status: 'expired' } as never);

    expect(updated[0].payload.status).toBe('expired');
  });
});
