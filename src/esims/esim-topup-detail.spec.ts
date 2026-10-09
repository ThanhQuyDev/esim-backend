import { EsimsService } from './esims.service';

/**
 * #026 — the eSIM detail lists which topup packages were applied and at what
 * price ("Gói Topup: Vietnam-3days-3gb-topup", "179.000đ").
 *
 * The figures come from the snapshot each topup order stored at checkout (#015),
 * never from a fresh provider lookup: a package that has since been withdrawn or
 * repriced must not rewrite what an eSIM was actually sold.
 */
describe('Topup packages on the eSIM detail (#026)', () => {
  const TOPUP = {
    orderId: 31,
    orderNumber: 'TOPUP-1',
    packageId: 'Vietnam-3days-3gb-topup',
    packageName: '3 GB - 3 Days',
    dataText: '3 GB',
    durationDays: 3,
    isUnlimited: false,
    vndPrice: 179000,
    vndCostPrice: 120000,
    provider: 'AIRALO',
    createdAt: new Date('2026-09-20T00:00:00.000Z'),
  };

  function makeService(
    esim: Record<string, unknown> | null,
    topups: Record<string, unknown>[] = [],
  ) {
    const esimsRepository = {
      findByIdWithRelations: jest.fn().mockResolvedValue(esim),
      findOrderNumbersByOrderItemIds: jest.fn().mockResolvedValue(new Map()),
      countTopupsByIccids: jest
        .fn()
        .mockResolvedValue(
          new Map(
            topups.length
              ? [['AAA', { count: topups.length, lastAt: TOPUP.createdAt }]]
              : [],
          ),
        ),
      findTopupsByIccid: jest.fn().mockResolvedValue(topups),
    };
    const service = Object.create(EsimsService.prototype) as EsimsService;
    (service as unknown as Record<string, unknown>).esimsRepository =
      esimsRepository;
    return { service, esimsRepository };
  }

  it('should lists the package, its price and its cost', async () => {
    const { service } = makeService({ id: 1, iccid: 'AAA' }, [TOPUP]);

    const esim = await service.findByIdWithRelations(1);

    expect(esim?.topups).toHaveLength(1);
    expect(esim?.topups?.[0]).toMatchObject({
      packageId: 'Vietnam-3days-3gb-topup',
      packageName: '3 GB - 3 Days',
      vndPrice: 179000,
      vndCostPrice: 120000,
      durationDays: 3,
    });
  });

  it('should also reports the count, so the list and the detail agree', async () => {
    const { service } = makeService({ id: 1, iccid: 'AAA' }, [TOPUP, TOPUP]);

    const esim = await service.findByIdWithRelations(1);

    expect(esim?.topupCount).toBe(2);
  });

  it('should returns an empty list for an eSIM never topped up', async () => {
    const { service } = makeService({ id: 1, iccid: 'AAA' }, []);

    const esim = await service.findByIdWithRelations(1);

    expect(esim?.topups).toEqual([]);
    expect(esim?.topupCount).toBe(0);
  });

  it('should does not look up topups for an eSIM that does not exist', async () => {
    const { service, esimsRepository } = makeService(null);

    await expect(service.findByIdWithRelations(999)).resolves.toBeNull();
    expect(esimsRepository.findTopupsByIccid).not.toHaveBeenCalled();
  });

  it('should keys the lookup on the ICCID, which is what a topup order records', async () => {
    const { service, esimsRepository } = makeService(
      { id: 1, iccid: 'AAA' },
      [],
    );

    await service.findByIdWithRelations(1);

    expect(esimsRepository.findTopupsByIccid).toHaveBeenCalledWith('AAA');
  });
});
