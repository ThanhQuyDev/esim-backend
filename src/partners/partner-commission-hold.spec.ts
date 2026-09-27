import { PartnersService } from './partners.service';
import { OrderPartnerCommissionStatusEnum } from './partners.enum';

/**
 * The 24h hold before a commission is approved (#019).
 *
 * Commission used to land in the wallet the moment the order was paid, so a
 * partner could see it, request a withdrawal, and only afterwards have the
 * customer cancel. An affiliate order now stays "Chờ xác nhận" for 24 hours
 * from when it was placed.
 */

function buildService(opts: {
  placedAt: Date;
  status?: OrderPartnerCommissionStatusEnum;
}) {
  const commission = {
    id: 3,
    partnerId: 5,
    linkId: null,
    commissionVnd: 120000,
    status: opts.status ?? OrderPartnerCommissionStatusEnum.PENDING,
  };
  const transactions: Record<string, unknown>[] = [];

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
    commissionRepository: {
      findOne: jest.fn().mockResolvedValue(commission),
      save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
    },
    linkRepository: { increment: jest.fn(), decrement: jest.fn() },
    getOrCreateWalletWithManager: jest
      .fn()
      .mockResolvedValue({ id: 1, partnerId: 5, balanceVnd: 0 }),
    walletRepository: { save: jest.fn() },
    dataSource: {
      query: jest.fn().mockResolvedValue([{ createdAt: opts.placedAt }]),
      transaction: (run: (manager: unknown) => unknown) =>
        run({
          getRepository: () => ({
            findOne: jest.fn().mockResolvedValue(null),
            create: (row: Record<string, unknown>) => row,
            save: (row: Record<string, unknown>) => {
              if ('type' in row) transactions.push(row);
              return Promise.resolve({ id: 99, ...row });
            },
          }),
        }),
    },
  });

  return { service, commission, transactions };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

describe('PartnersService — the 24h hold on commission (#019)', () => {
  it('should leave an order placed an hour ago waiting', async () => {
    const { service, commission, transactions } = buildService({
      placedAt: hoursAgo(1),
    });

    await service.creditCommissionForOrder(77);

    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.PENDING);
    expect(transactions).toHaveLength(0);
  });

  it('should credit an order that has passed the window', async () => {
    const { service, commission, transactions } = buildService({
      placedAt: hoursAgo(25),
    });

    await service.creditCommissionForOrder(77);

    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.CREDITED);
    expect(transactions[0]).toMatchObject({ amountVnd: 120000 });
  });

  it('should credit straight away when payment lands after the window', async () => {
    // A bank transfer that arrives two days after checkout: the customer's
    // cancellation window has already passed by the time the money does.
    const { service, commission } = buildService({ placedAt: hoursAgo(48) });

    await service.creditCommissionForOrder(77);

    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.CREDITED);
  });

  it('should keep the sweep going when one order fails', async () => {
    const { service } = buildService({ placedAt: hoursAgo(25) });
    const failing = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(undefined);

    Object.assign(service, {
      dataSource: {
        query: jest.fn().mockResolvedValue([{ orderId: 1 }, { orderId: 2 }]),
      },
      creditCommissionForOrder: failing,
    });

    await service.creditMaturedCommissions();

    expect(failing).toHaveBeenCalledTimes(2);
  });
});
