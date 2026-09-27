import { PartnersService } from './partners.service';
import { OrderPartnerCommissionStatusEnum } from './partners.enum';

/**
 * Refunding one product out of several (#018).
 *
 * An affiliate order carries several eSIMs. Refunding one of them left the
 * whole commission standing, so the partner kept earning on a product the
 * customer no longer has — and a second refund on the same order has to charge
 * only the difference, not the whole share again.
 */

function buildService(commission: Record<string, unknown>) {
  const transactions: Record<string, unknown>[] = [];
  const decrement = jest.fn();
  const wallet = { id: 1, partnerId: 5, balanceVnd: 1_000_000 };

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { warn: jest.fn(), error: jest.fn() },
    commissionRepository: {
      findOne: jest.fn().mockResolvedValue(commission),
      save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
    },
    linkRepository: { decrement, increment: jest.fn() },
    getOrCreateWalletWithManager: jest.fn().mockResolvedValue(wallet),
    walletRepository: { save: jest.fn() },
    dataSource: {
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

  return { service, transactions, decrement, wallet };
}

describe('PartnersService — commission on a partially refunded order (#018)', () => {
  it('should take back only the share of the refunded products', async () => {
    const commission = {
      id: 3,
      partnerId: 5,
      linkId: 11,
      commissionVnd: 200000,
      reversedCommissionVnd: 0,
      status: OrderPartnerCommissionStatusEnum.CREDITED,
    };
    const { service, transactions, decrement, wallet } =
      buildService(commission);

    // A 2.000.000đ order, 500.000đ of it refunded: a quarter of the commission.
    await service.adjustCommissionForPartialRefund({
      orderId: 77,
      refundedAmountVnd: 500_000,
      orderValueVnd: 2_000_000,
    });

    expect(transactions[0]).toMatchObject({ amountVnd: -50000 });
    expect(wallet.balanceVnd).toBe(950_000);
    expect(commission.commissionVnd).toBe(150_000);
    expect(commission.reversedCommissionVnd).toBe(50_000);
    // Still a conversion: the customer kept the rest of the order.
    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.CREDITED);
    expect(decrement).toHaveBeenCalledWith(
      { id: 11 },
      'totalCommissionVnd',
      50000,
    );
  });

  it('should charge only the difference on a second refund', async () => {
    const commission = {
      id: 3,
      partnerId: 5,
      linkId: null,
      commissionVnd: 150_000,
      reversedCommissionVnd: 50_000,
      status: OrderPartnerCommissionStatusEnum.CREDITED,
    };
    const { service, transactions } = buildService(commission);

    // Cumulative refund is now 1.000.000đ of the same 2.000.000đ order.
    await service.adjustCommissionForPartialRefund({
      orderId: 77,
      refundedAmountVnd: 1_000_000,
      orderValueVnd: 2_000_000,
    });

    expect(transactions[0]).toMatchObject({ amountVnd: -50000 });
    expect(commission.commissionVnd).toBe(100_000);
    expect(commission.reversedCommissionVnd).toBe(100_000);
  });

  it('should do nothing when the same refund total arrives twice', async () => {
    const commission = {
      id: 3,
      partnerId: 5,
      linkId: null,
      commissionVnd: 150_000,
      reversedCommissionVnd: 50_000,
      status: OrderPartnerCommissionStatusEnum.CREDITED,
    };
    const { service, transactions } = buildService(commission);

    await service.adjustCommissionForPartialRefund({
      orderId: 77,
      refundedAmountVnd: 500_000,
      orderValueVnd: 2_000_000,
    });

    expect(transactions).toHaveLength(0);
    expect(commission.commissionVnd).toBe(150_000);
  });

  it('should reverse the row and drop the conversion when refunds reach the whole order', async () => {
    const commission = {
      id: 3,
      partnerId: 5,
      linkId: 11,
      commissionVnd: 200_000,
      reversedCommissionVnd: 0,
      status: OrderPartnerCommissionStatusEnum.CREDITED,
    };
    const { service, decrement } = buildService(commission);

    await service.adjustCommissionForPartialRefund({
      orderId: 77,
      refundedAmountVnd: 2_000_000,
      orderValueVnd: 2_000_000,
    });

    expect(commission.commissionVnd).toBe(0);
    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.REVERSED);
    expect(decrement).toHaveBeenCalledWith({ id: 11 }, 'conversionCount', 1);
  });

  it('should reduce a pending commission without touching the wallet', async () => {
    const commission = {
      id: 4,
      partnerId: 5,
      linkId: null,
      commissionVnd: 100_000,
      reversedCommissionVnd: 0,
      status: OrderPartnerCommissionStatusEnum.PENDING,
    };
    const { service, transactions } = buildService(commission);

    await service.adjustCommissionForPartialRefund({
      orderId: 78,
      refundedAmountVnd: 250_000,
      orderValueVnd: 1_000_000,
    });

    // Nothing was credited yet, so there is nothing to debit — the amount the
    // partner will be paid is simply smaller.
    expect(transactions).toHaveLength(0);
    expect(commission.commissionVnd).toBe(75_000);
  });
});
