import { PartnersService } from './partners.service';
import { OrderPartnerCommissionStatusEnum } from './partners.enum';

/**
 * doitac-3010 #002 — only an order the customer paid counts for the partner.
 *
 * A failed checkout used to leave a PENDING share behind: it showed in the
 * "chờ duyệt" queue, in the link's order count and in every total. The share
 * of an unpaid order is now UNPAID and counts nowhere until the payment lands.
 */

function creatingService(selfReferral: string | null = null) {
  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { warn: jest.fn() },
    partnerRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 9, partnerType: 'kol', tierCode: 'T7' }),
    },
    detectSelfReferral: jest.fn().mockResolvedValue(selfReferral),
    tierRepository: {
      findOne: jest.fn().mockResolvedValue({ commissionPercent: 10 }),
    },
    couponRepository: { findOne: jest.fn().mockResolvedValue(null) },
    commissionRepository: { create: (row: unknown) => row, save },
  });
  return { service, save };
}

function creditingService(opts: {
  orderStatus: string;
  rejectionReason?: string | null;
  placedHoursAgo?: number;
}) {
  const commission = {
    id: 3,
    partnerId: 5,
    linkId: null,
    commissionVnd: 571000,
    rejectionReason: opts.rejectionReason ?? null,
    status: OrderPartnerCommissionStatusEnum.UNPAID,
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
      query: jest.fn().mockResolvedValue([
        {
          createdAt: new Date(
            Date.now() - (opts.placedHoursAgo ?? 1) * 3600_000,
          ),
          status: opts.orderStatus,
        },
      ]),
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

describe('PartnersService — unpaid orders earn nothing yet (doitac-3010 #002)', () => {
  it('should store the share of an unpaid order as UNPAID', async () => {
    const { service, save } = creatingService();

    await service.createPendingCommissionForOrder({
      orderId: 1,
      partnerId: 9,
      linkId: 4,
      orderValueVnd: 5_710_000,
      paid: false,
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        commissionVnd: 571_000,
        status: OrderPartnerCommissionStatusEnum.UNPAID,
      }),
    );
  });

  it('should queue the share of an order paid at checkout', async () => {
    const { service, save } = creatingService();

    await service.createPendingCommissionForOrder({
      orderId: 1,
      partnerId: 9,
      linkId: 4,
      orderValueVnd: 100_000,
      paid: true,
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OrderPartnerCommissionStatusEnum.PENDING,
      }),
    );
  });

  it('should hold a self-referral verdict until the order is paid', async () => {
    const { service, save } = creatingService('email');

    await service.createPendingCommissionForOrder({
      orderId: 1,
      partnerId: 9,
      linkId: 4,
      orderValueVnd: 100_000,
      paid: false,
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OrderPartnerCommissionStatusEnum.UNPAID,
        rejectionReason: 'email',
      }),
    );
  });

  it('should leave a failed order UNPAID and credit nothing', async () => {
    const { service, commission, transactions } = creditingService({
      orderStatus: 'failed',
      placedHoursAgo: 48,
    });

    await service.creditCommissionForOrder(77);

    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.UNPAID);
    expect(transactions).toHaveLength(0);
  });

  it('should move a just-paid order into the 24h queue', async () => {
    const { service, commission, transactions } = creditingService({
      orderStatus: 'paid',
      placedHoursAgo: 1,
    });

    await service.creditCommissionForOrder(77);

    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.PENDING);
    expect(transactions).toHaveLength(0);
  });

  it('should credit straight away when the payment lands after 24h', async () => {
    const { service, commission, transactions } = creditingService({
      orderStatus: 'paid',
      placedHoursAgo: 30,
    });

    await service.creditCommissionForOrder(77);

    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.CREDITED);
    expect(transactions[0]).toMatchObject({ amountVnd: 571000 });
  });

  it('should turn a paid self-referral into REJECTED, not money', async () => {
    const { service, commission, transactions } = creditingService({
      orderStatus: 'paid',
      rejectionReason: 'email',
      placedHoursAgo: 30,
    });

    await service.creditCommissionForOrder(77);

    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.REJECTED);
    expect(transactions).toHaveLength(0);
  });
});
