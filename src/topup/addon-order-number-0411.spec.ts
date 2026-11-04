import { TopupService } from './topup.service';
import { isTopupOrderNumber } from './topup.constants';

/** vande-0411 #018 — an add-on order reads ADDON-…, and is still paid as one. */
function makeService(packageId: string) {
  const created: Record<string, unknown>[] = [];
  const service = Object.create(TopupService.prototype) as TopupService;
  Object.assign(service, {
    orderRepository: {
      create: jest.fn((payload: Record<string, unknown>) => {
        created.push(payload);
        return Promise.resolve({ id: 9, ...payload });
      }),
    },
    invoicesService: { createForOrder: jest.fn() },
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    resolveProviderForIccid: jest
      .fn()
      .mockResolvedValue({ provider: 'BILLION' }),
    listPackages: jest.fn().mockResolvedValue({
      packages: [
        {
          packageId,
          name: '1 GB',
          dataAmountText: '1 GB',
          durationDays: 1,
          isUnlimited: false,
          price: 2,
          retailPrice: 3,
          vndPrice: 76000,
        },
      ],
    }),
    fetchVndRate: jest.fn().mockResolvedValue(25500),
  });
  return { service, created };
}

const orderNumberFor = async (packageId: string) => {
  const { service, created } = makeService(packageId);
  await (
    service as never as {
      createPendingTopupOrder(u: number, d: unknown): Promise<unknown>;
    }
  ).createPendingTopupOrder(1, {
    iccid: '8900',
    packageId,
    provider: 'BILLION',
    paymentMethod: 'ONEPAY',
  });
  return String(created[0].orderNumber);
};

describe('Mã đơn add-on (vande-0411 #018)', () => {
  it('should number an add-on ADDON-', async () => {
    expect(await orderNumberFor('billion-acc:0:sku:1')).toMatch(
      /^ADDON-\d{15}-/,
    );
  });

  it('should keep TOPUP- for a top-up', async () => {
    expect(await orderNumberFor('billion:sku:7')).toMatch(/^TOPUP-\d{15}-/);
  });

  it('should route both through the top-up payment', () => {
    expect(isTopupOrderNumber('ADDON-261031-X')).toBe(true);
    expect(isTopupOrderNumber('TOPUP-261031-X')).toBe(true);
    expect(isTopupOrderNumber('ORD-261031-X')).toBe(false);
    expect(isTopupOrderNumber('PTN-ADDON-1')).toBe(false);
  });
});
