import { buildEsimPackages } from './esim-packages';
import { EsimsService } from './esims.service';

const PLAN = {
  name: 'Vietnam 1GB',
  type: 'fixed',
  dataMb: 1024,
  durationDays: 7,
};
const TOPUP = {
  orderId: 9,
  orderNumber: 'TOPUP-1',
  packageId: 'vn-2gb',
  packageName: 'Vietnam 2GB',
  dataText: '2 GB',
  durationDays: 15,
  isUnlimited: false,
  vndPrice: 81000,
  status: 'completed',
  createdAt: '2026-11-01T03:06:00Z',
};
const ACTIVATED = '2026-11-01T02:31:00Z';

describe('Gói ban đầu và gói mua thêm (vande-0411 #020)', () => {
  it('should run a top-up after the first package, as in the picture', () => {
    const [first, topup] = buildEsimPackages(
      {
        plan: PLAN,
        activatedAt: ACTIVATED,
        baseLine: {
          orderId: 1,
          orderNumber: 'ESIM-1',
          vndPrice: 55000,
          createdAt: '2026-11-01T02:10:00Z',
        },
        topups: [TOPUP],
      },
      new Date('2026-11-02T00:00:00Z'),
    );

    expect(first).toMatchObject({
      kind: 'initial',
      dataText: '1 GB',
      durationDays: 7,
      status: 'active',
      vndPrice: 55000,
    });
    expect(first.expiresAt).toEqual(new Date('2026-11-08T02:31:00Z'));
    expect(topup).toMatchObject({ kind: 'topup', status: 'waiting' });
    expect(topup.activatedAt).toEqual(new Date('2026-11-08T02:31:00Z'));
    expect(topup.expiresAt).toEqual(new Date('2026-11-23T02:31:00Z'));
  });

  it('should show the first as expired and the top-up as active later on', () => {
    const [first, topup] = buildEsimPackages(
      { plan: PLAN, activatedAt: ACTIVATED, topups: [TOPUP] },
      new Date('2026-11-10T00:00:00Z'),
    );

    expect(first.status).toBe('expired');
    expect(topup.status).toBe('active');
  });

  it('should keep an add-on on the date of the package it was bought on', () => {
    const [first, addon] = buildEsimPackages(
      {
        plan: PLAN,
        activatedAt: ACTIVATED,
        topups: [{ ...TOPUP, packageId: 'billion-acc:2:1', durationDays: 3 }],
      },
      new Date('2026-11-02T00:00:00Z'),
    );

    expect(addon).toMatchObject({ kind: 'addon', durationDays: null });
    expect(addon.expiresAt).toEqual(first.expiresAt);
  });

  it('should give no dates while the eSIM is not switched on', () => {
    const [first, topup] = buildEsimPackages({ plan: PLAN, topups: [TOPUP] });

    expect(first).toMatchObject({ status: 'waiting', activatedAt: null });
    expect(topup).toMatchObject({ status: 'waiting', expiresAt: null });
  });

  it('should not count a top-up still with the supplier', () => {
    const packages = buildEsimPackages(
      {
        plan: PLAN,
        activatedAt: ACTIVATED,
        topups: [{ ...TOPUP, status: 'paid' }],
      },
      new Date('2026-11-02T00:00:00Z'),
    );

    expect(packages[1]).toMatchObject({
      status: 'processing',
      expiresAt: null,
    });
    expect(packages[0].expiresAt).toEqual(new Date('2026-11-08T02:31:00Z'));
  });

  it('should let the date stored on the eSIM end the last package', () => {
    const stored = new Date('2026-11-17T00:00:00Z');
    const packages = buildEsimPackages(
      {
        plan: PLAN,
        activatedAt: ACTIVATED,
        expiresAt: stored,
        topups: [TOPUP],
      },
      new Date('2026-11-02T00:00:00Z'),
    );

    expect(packages[1].expiresAt).toEqual(stored);
    expect(packages[0].expiresAt).toEqual(new Date('2026-11-08T02:31:00Z'));
  });

  it('should read a day pass by the days the customer chose', () => {
    const [first] = buildEsimPackages({
      plan: { ...PLAN, type: 'daily', durationDays: 1 },
      chosenDays: 5,
      topups: [],
    });

    expect(first).toMatchObject({ durationDays: 5, perDay: true });
  });
});

describe('Gói trên trang tra cứu công khai (vande-0411 #020)', () => {
  const ESIM = {
    id: 7,
    topupCount: 1,
    packages: [
      { kind: 'initial', orderId: 1, orderNumber: 'E', vndPrice: 500 },
    ],
  };

  function publicOf(soldToDistributor: boolean, esim: unknown = ESIM) {
    const svc = Object.create(EsimsService.prototype) as EsimsService;
    Object.assign(svc, {
      esimsRepository: {
        findBaseOrderLine: jest.fn().mockResolvedValue({ soldToDistributor }),
      },
    });
    return svc.publicPackagesOf(esim as never);
  }

  it('should show the price but no order references', async () => {
    const { packages } = await publicOf(false);

    expect(packages[0]).toEqual({ kind: 'initial', vndPrice: 500 });
  });

  it('should hide the wholesale price of what a partner bought', async () => {
    const { packages } = await publicOf(true);

    expect(packages[0].vndPrice).toBeNull();
  });

  it('should show nothing on an eSIM with no top-up', async () => {
    const { packages } = await publicOf(false, { ...ESIM, topupCount: 0 });

    expect(packages).toEqual([]);
  });
});
