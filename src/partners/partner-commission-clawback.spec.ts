import { PartnersService } from './partners.service';
import {
  OrderPartnerCommissionStatusEnum,
  PartnerPayoutStatusEnum,
} from './partners.enum';

/**
 * Commission already paid out, order refunded afterwards (#007).
 *
 * The brief: "tiền hoa hồng của đối tác sẽ về số âm để cấn trừ qua kỳ thanh
 * toán tiếp theo". Two holes were in the way — a cancelled order left a
 * credited commission alone, and the debt a clawback creates was invisible
 * behind an available balance that floors at zero.
 */

function buildService(
  commission: Record<string, unknown> | null,
  wallet = { id: 1, partnerId: 5, balanceVnd: 0 },
) {
  const commissionSave = jest
    .fn()
    .mockImplementation((row) => Promise.resolve(row));
  const walletSave = jest
    .fn()
    .mockImplementation((row) => Promise.resolve(row));
  const transactions: Record<string, unknown>[] = [];

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { warn: jest.fn(), error: jest.fn() },
    commissionRepository: {
      findOne: jest.fn().mockResolvedValue(commission),
      save: commissionSave,
    },
    linkRepository: { increment: jest.fn() },
    walletRepository: { save: walletSave },
    getOrCreateWalletWithManager: jest.fn().mockResolvedValue(wallet),
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

  return { service, transactions, wallet, commissionSave };
}

describe('PartnersService — clawing a paid commission back (#007)', () => {
  it('should reverse a credited commission when the order is cancelled', async () => {
    const commission = {
      id: 3,
      partnerId: 5,
      commissionVnd: 120000,
      status: OrderPartnerCommissionStatusEnum.CREDITED,
    };
    const { service, transactions, wallet } = buildService(commission);

    await service.reverseCommissionForOrder(77, { cancelled: true });

    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.REVERSED);
    expect(transactions[0]).toMatchObject({
      amountVnd: -120000,
      reason: 'Hoàn hoa hồng do đơn hàng bị hủy',
    });
    // Already withdrawn, so the wallet goes below zero and stays there.
    expect(wallet.balanceVnd).toBe(-120000);
  });

  it('should let the balance go negative on a full refund after payout', async () => {
    const { service, wallet } = buildService(
      {
        id: 4,
        partnerId: 5,
        commissionVnd: 500000,
        status: OrderPartnerCommissionStatusEnum.CREDITED,
      },
      { id: 1, partnerId: 5, balanceVnd: 200000 },
    );

    await service.reverseCommissionForOrder(78, { fullRefund: true });

    expect(wallet.balanceVnd).toBe(-300000);
  });

  it('should still leave a partial refund for manual review', async () => {
    const commission = {
      id: 5,
      partnerId: 5,
      commissionVnd: 90000,
      status: OrderPartnerCommissionStatusEnum.CREDITED,
    };
    const { service, transactions } = buildService(commission);

    await service.reverseCommissionForOrder(79, { fullRefund: false });

    expect(commission.status).toBe(OrderPartnerCommissionStatusEnum.CREDITED);
    expect(transactions).toHaveLength(0);
  });
});

describe('PartnersService — the debt is visible and blocks withdrawal (#007)', () => {
  function buildSummaryService(balanceVnd: number) {
    const sum = (value: number) => ({
      select: () => ({
        where: () => ({
          andWhere: () => ({
            getRawOne: () => Promise.resolve({ sum: String(value) }),
          }),
        }),
      }),
    });

    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      getOrCreateWallet: jest
        .fn()
        .mockResolvedValue({ balanceVnd, status: 'active' }),
      payoutRepository: { createQueryBuilder: () => sum(0) },
      commissionRepository: { createQueryBuilder: () => sum(0) },
    });
    return service;
  }

  it('should report the clawed-back amount as a debt to be netted off', async () => {
    const service = buildSummaryService(-300000);

    const summary = await service.getWalletSummaryForPartner(5);

    expect(summary.balanceVnd).toBe(-300000);
    expect(summary.carriedDebtVnd).toBe(300000);
    // Nothing is withdrawable until the next commissions pay the debt off.
    expect(summary.availableBalanceVnd).toBe(0);
  });

  it('should report no debt for a partner in credit', async () => {
    const service = buildSummaryService(450000);

    const summary = await service.getWalletSummaryForPartner(5);

    expect(summary.carriedDebtVnd).toBe(0);
    expect(summary.availableBalanceVnd).toBe(450000);
  });

  it('should refuse a withdrawal while the balance is negative', async () => {
    const service = buildSummaryService(-50000);
    Object.assign(service, {
      getPartnerOrThrowById: jest.fn(),
      payoutRepository: {
        createQueryBuilder: () => ({
          select: () => ({
            where: () => ({
              andWhere: () => ({
                getRawOne: () => Promise.resolve({ sum: '0' }),
              }),
            }),
          }),
        }),
        create: (row: unknown) => row,
        save: jest.fn(),
      },
    });

    await expect(
      service.createPayoutRequest(5, {
        amountVnd: 10000,
        status: PartnerPayoutStatusEnum.PENDING,
      } as never),
    ).rejects.toThrow('Số dư khả dụng không đủ');
  });
});
