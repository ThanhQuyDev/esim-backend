import { EsimsService, topupDataMb } from './esims.service';

/**
 * doitac-3010 #006 — a 20 GB eSIM topped up with 5 GB read "100 MB / 5 GB":
 * the supplier reports the package running now, and the top-up never reached
 * the eSIM's total or its expiry.
 */
function service(opts: {
  planType?: string;
  planMb?: number;
  topups?: string[];
}) {
  const update = jest.fn().mockResolvedValue(undefined);
  const svc = Object.create(EsimsService.prototype) as EsimsService;
  Object.assign(svc, {
    esimsRepository: { update },
    dataSource: {
      query: jest.fn((sql: string) =>
        Promise.resolve(
          sql.includes('FROM plan')
            ? [{ type: opts.planType ?? 'fixed', dataMb: opts.planMb ?? 20480 }]
            : (opts.topups ?? []).map((t) => ({ topupDataText: t })),
        ),
      ),
    },
  });
  return { svc, update };
}

const ESIM = { id: 9, iccid: '8900000425434292554', planId: 3 };

describe('topupDataMb', () => {
  it('should read what a top-up order stores', () => {
    expect(topupDataMb('5 GB')).toBe(5120);
    expect(topupDataMb('500MB')).toBe(500);
    expect(topupDataMb('1,5 GB')).toBe(1536);
    expect(topupDataMb('Unlimited')).toBe(0);
  });
});

describe("An eSIM's whole allowance (doitac-3010 #006)", () => {
  it('should add the top-ups to the plan', async () => {
    const { svc } = service({ topups: ['5 GB'] });
    expect(await svc.allowanceMb(ESIM as never)).toEqual({
      planMb: 20480,
      totalMb: 25600,
    });
  });

  it('should leave day passes and unlimited plans alone', async () => {
    const { svc } = service({ planType: 'daily' });
    expect(await svc.allowanceMb(ESIM as never)).toBeNull();
  });

  it('should not show a 20 GB eSIM as 5 GB when the supplier reports the top-up package', async () => {
    const { svc } = service({ topups: ['5 GB'] });
    // The plan is spent and the 5 GB top-up has 4.9 GB left.
    const result = {
      total: 5120,
      dataUsed: 100,
      remaining: 5020,
      isUnlimited: false,
    } as never as Record<string, number>;

    await (
      svc as unknown as {
        applyAllowanceFloor: (e: unknown, r: unknown) => Promise<void>;
      }
    ).applyAllowanceFloor(ESIM, result);

    expect(result.total).toBe(25600);
    expect(result.dataUsed).toBe(20580);
  });

  it("should keep the supplier's figure while it still reports the plan itself", async () => {
    const { svc } = service({ topups: ['5 GB'] });
    const result = {
      total: 20480,
      dataUsed: 100,
      remaining: 20380,
      isUnlimited: false,
    } as never as Record<string, number>;

    await (
      svc as unknown as {
        applyAllowanceFloor: (e: unknown, r: unknown) => Promise<void>;
      }
    ).applyAllowanceFloor(ESIM, result);

    expect(result.total).toBe(25600);
    expect(result.dataUsed).toBe(100);
  });

  it('should add the data and days of a top-up that went through', async () => {
    const { svc, update } = service({ topups: ['5 GB'] });
    const now = new Date('2026-11-01T00:00:00Z');
    Object.assign(svc, {
      findByIccid: jest.fn().mockResolvedValue({
        ...ESIM,
        dataTotal: '20480',
        activatedAt: new Date('2026-10-20T00:00:00Z'),
        expiresAt: new Date('2026-11-10T00:00:00Z'),
      }),
    });

    await svc.applyCompletedTopup(ESIM.iccid, { durationDays: 30 }, now);

    expect(update).toHaveBeenCalledWith(9, {
      dataTotal: '25600',
      expiresAt: new Date('2026-12-01T00:00:00Z'),
    });
  });
});
