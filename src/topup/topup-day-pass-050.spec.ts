import { TopupService, topupDays } from './topup.service';
import { TopupProvider } from './dto/topup-package.dto';

/**
 * doitac-3010 #050 — an eSIM Access day pass ("1 GB/ngày") topped up for
 * several days: the days reach the supplier as `periodNum`, and the price and
 * cost cover every day. The supplier is mocked: no real top-up is sent.
 */
const ICCID = '8965012606160264608';

function makeService(packages: Record<string, unknown>[]) {
  let created: Record<string, unknown> = {};
  const orderRepository = {
    create: jest.fn((payload: Record<string, unknown>) => {
      created = { id: 1, ...payload };
      return Promise.resolve(created);
    }),
    update: jest.fn((_id: unknown, payload: Record<string, unknown>) => {
      created = { ...created, ...payload };
      return Promise.resolve(created);
    }),
    findByOrderNumber: jest.fn(() => Promise.resolve(created)),
  };
  const esimAccessService = {
    submitTopup: jest.fn().mockResolvedValue({ orderNo: 'EA-1' }),
  };
  const profitMarginsService = {
    // A flat 30% margin, rounded to the thousand.
    calculateRetailVndFromCostUsd: jest.fn((usd: number, rate: number) =>
      Promise.resolve(Math.round((usd * rate * 1.3) / 1000) * 1000),
    ),
  };
  const service = new TopupService(
    orderRepository as never,
    {
      findByIccid: jest
        .fn()
        .mockResolvedValue({ id: 9, userId: 77, provider: 'esimaccess' }),
    } as never,
    {} as never,
    {} as never,
    esimAccessService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    profitMarginsService as never,
    {} as never,
    {} as never,
    {} as never,
  );
  jest.spyOn(service, 'listPackages').mockResolvedValue({
    iccid: ICCID,
    provider: TopupProvider.ESIM_ACCESS,
    packages: packages as never,
  });
  jest
    .spyOn(service as never, 'resolveProviderForIccid')
    .mockResolvedValue({ provider: TopupProvider.ESIM_ACCESS } as never);
  jest
    .spyOn(service as never, 'fetchVndRate')
    .mockResolvedValue(25000 as never);
  return {
    service,
    orderRepository,
    esimAccessService,
    created: () => created,
  };
}

const DAY_PASS = {
  packageId: 'EA-VN-1GB-D',
  name: 'Vietnam 1GB/day',
  durationDays: 1,
  isDayPass: true,
  price: 0.5,
  retailPrice: 0.8,
  vndPrice: 20000,
};

describe('Day-pass top-up for several days (doitac-3010 #050)', () => {
  it('should read the days only for a day pass, 1 to 365', () => {
    expect(topupDays({ isDayPass: true }, 5)).toBe(5);
    expect(topupDays({ isDayPass: true }, 999)).toBe(365);
    expect(topupDays({ isDayPass: true }, 0)).toBe(1);
    expect(topupDays({ isDayPass: false }, 5)).toBe(1);
  });

  it('should price, record and send all the days', async () => {
    const { service, orderRepository, esimAccessService } = makeService([
      DAY_PASS,
    ]);
    jest.spyOn(service, 'executeTopup').mockRestore();
    await service.adminManualTopup(
      {
        iccid: ICCID,
        packageId: DAY_PASS.packageId,
        provider: TopupProvider.ESIM_ACCESS,
        periodNum: 5,
      },
      1,
    );
    const order = orderRepository.create.mock.calls[0][0];
    // 0.5 USD × 5 days × 25.000 × 1.3 = 81.250 → 81.000đ.
    expect(order.vndPrice).toBe(81000);
    // 0.5 × 5 × 25.000 = 62.500 → 63.000đ cost.
    expect(order.vndCostPrice).toBe(63000);
    expect(order.topupPeriodNum).toBe(5);
    expect(order.topupDurationDays).toBe(5);
    expect(order.topupPackageName).toBe('Vietnam 1GB/day × 5 ngày');
    expect(esimAccessService.submitTopup).toHaveBeenCalledWith(
      expect.objectContaining({ packageCode: 'EA-VN-1GB-D', periodNum: 5 }),
    );
  });

  it('should leave a non-day-pass package at one purchase', async () => {
    const { service, orderRepository } = makeService([
      { ...DAY_PASS, isDayPass: false, packageId: 'EA-VN-5GB-30' },
    ]);
    jest.spyOn(service, 'executeTopup').mockResolvedValue(undefined);
    await service.adminManualTopup(
      {
        iccid: ICCID,
        packageId: 'EA-VN-5GB-30',
        provider: TopupProvider.ESIM_ACCESS,
        periodNum: 5,
      },
      1,
    );
    const order = orderRepository.create.mock.calls[0][0];
    expect(order.vndPrice).toBe(20000);
    expect(order.topupPeriodNum).toBeNull();
  });
});
