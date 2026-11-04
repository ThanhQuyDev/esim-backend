import { EsimsService, laterExpiry } from './esims.service';

/** vande-0411 #019 — a top-up adds to what the eSIM already has. */
const ESIM = { id: 7, iccid: '8901', planId: 3 };

function service(esim: Record<string, unknown>, addedDays = 0) {
  const update = jest.fn().mockResolvedValue(undefined);
  const svc = Object.create(EsimsService.prototype) as EsimsService;
  Object.assign(svc, {
    esimsRepository: {
      update,
      findByIccid: jest.fn().mockResolvedValue({ ...ESIM, ...esim }),
      findChosenDaysByIds: jest.fn().mockResolvedValue(new Map()),
      countTopupsByIccids: jest
        .fn()
        .mockResolvedValue(new Map([['8901', { addedDays }]])),
      findChosenDays: jest.fn().mockResolvedValue(7),
      findByIdWithRelations: jest
        .fn()
        .mockResolvedValue({ plan: { durationDays: 7 } }),
    },
    dataSource: undefined,
    findByIccid: jest.fn().mockResolvedValue({ ...ESIM, ...esim }),
  });
  return { svc, update };
}

describe('Cộng dồn ưu đãi sau topup (vande-0411 #019)', () => {
  const NOW = new Date('2026-11-02T00:00:00Z');

  it("should add the days after what is left, as anh Thọ's Airalo example", async () => {
    const { svc, update } = service({
      expiresAt: new Date('2026-11-08T00:00:00Z'),
    });

    await svc.applyCompletedTopup('8901', { durationDays: 15 }, NOW);

    expect(update).toHaveBeenCalledWith(7, {
      expiresAt: new Date('2026-11-23T00:00:00Z'),
    });
  });

  it('should start again from now once the eSIM has run out', async () => {
    const { svc, update } = service({
      expiresAt: new Date('2026-10-01T00:00:00Z'),
    });

    await svc.applyCompletedTopup('8901', { durationDays: 15 }, NOW);

    expect(update).toHaveBeenCalledWith(7, {
      expiresAt: new Date('2026-11-17T00:00:00Z'),
    });
  });

  it('should keep the days left when the supplier gave no date', async () => {
    // Switched on 1/11 for 7 days: ends 8/11. This order's 15 is already counted.
    const { svc, update } = service(
      { expiresAt: null, activatedAt: new Date('2026-11-01T00:00:00Z') },
      15,
    );

    await svc.applyCompletedTopup('8901', { durationDays: 15 }, NOW);

    expect(update).toHaveBeenCalledWith(7, {
      expiresAt: new Date('2026-11-23T00:00:00Z'),
    });
  });

  it('should leave the date of an eSIM not switched on yet', async () => {
    const { svc, update } = service({ expiresAt: null, activatedAt: null });

    await svc.applyCompletedTopup('8901', { durationDays: 15 }, NOW);

    expect(update).not.toHaveBeenCalled();
  });

  it('should not move the date for an add-on', async () => {
    const { svc, update } = service({
      expiresAt: new Date('2026-11-08T00:00:00Z'),
    });

    await svc.applyCompletedTopup('8901', { durationDays: null }, NOW);

    expect(update).not.toHaveBeenCalled();
  });

  it("should not let a supplier's package date cut a top-up short", async () => {
    const expiresAt = new Date('2026-11-23T00:00:00Z');
    const { svc, update } = service({ expiresAt }, 15);

    await (
      svc as never as {
        persistUsageSnapshot(e: unknown, r: unknown): Promise<void>;
      }
    ).persistUsageSnapshot(
      { ...ESIM, expiresAt },
      { dataUsed: 1, total: 0, expiredAt: '2026-11-08T00:00:00Z' },
    );

    expect(update.mock.calls[0][1]).not.toHaveProperty('expiresAt');
  });

  it('should still take a later date from the supplier', async () => {
    const expiresAt = new Date('2026-11-23T00:00:00Z');
    const { svc, update } = service({ expiresAt }, 15);

    await (
      svc as never as {
        persistUsageSnapshot(e: unknown, r: unknown): Promise<void>;
      }
    ).persistUsageSnapshot(
      { ...ESIM, expiresAt },
      { dataUsed: 1, total: 0, expiredAt: '2026-11-25T00:00:00Z' },
    );

    expect(update.mock.calls[0][1].expiresAt).toEqual(
      new Date('2026-11-25T00:00:00Z'),
    );
  });

  it('should pick the later of two dates', () => {
    expect(
      laterExpiry('2026-11-08T00:00:00Z', new Date('2026-11-23T00:00:00Z')),
    ).toBe('2026-11-23T00:00:00.000Z');
    expect(laterExpiry(null, null)).toBeNull();
  });
});
