import 'reflect-metadata';
import { PartnersService } from './partners.service';
import {
  PartnerTypeEnum,
  PartnerWalletTransactionTypeEnum,
} from './partners.enum';

/**
 * "Không cần ký quỹ" (vande #056): a partner buys on a monthly credit limit
 * instead of a deposit. Money moves here, so every way the wallet can change
 * is pinned down.
 */
function buildService({
  partner = {},
  balanceVnd = 0,
  ledger = [] as Record<string, unknown>[],
}: {
  partner?: Record<string, unknown>;
  balanceVnd?: number;
  ledger?: Record<string, unknown>[];
} = {}) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const row = {
    id: 11,
    partnerType: PartnerTypeEnum.DISTRIBUTION,
    status: 'active',
    contactName: 'Anh Sơn',
    contactEmail: 'son@example.com',
    noDepositRequired: false,
    creditLimitVnd: 0,
    ...partner,
  };
  const writes: {
    type: string;
    amount: number;
    key?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
  }[] = [];
  const updates: Record<string, unknown>[] = [];
  const wallet = { id: 1, balanceVnd };
  const manager = {
    getRepository: () => ({
      update: jest.fn((_where: unknown, patch: Record<string, unknown>) => {
        updates.push(patch);
        return Promise.resolve();
      }),
      // The 0đ "credit stopped here" marker (vande #056).
      create: (r: Record<string, unknown>) => r,
      save: jest.fn(
        (r: {
          type: string;
          amountVnd: number;
          metadata: Record<string, unknown>;
        }) => {
          writes.push({
            type: r.type,
            amount: r.amountVnd,
            metadata: r.metadata,
          });
          return Promise.resolve(r);
        },
      ),
      createQueryBuilder: () => ({
        setLock: () => ({
          where: () => ({ getOne: () => Promise.resolve(wallet) }),
        }),
      }),
    }),
  };
  const sendPartnerCreditStatement = jest.fn().mockResolvedValue(undefined);
  Object.assign(service, {
    logger: { log: jest.fn(), error: jest.fn() },
    adminFindById: jest.fn().mockResolvedValue(row),
    getPartnerOrThrowById: jest.fn().mockResolvedValue(row),
    getOrCreateWalletWithManager: jest.fn().mockResolvedValue(wallet),
    createWalletTransactionWithManager: jest.fn(
      (
        _id: number,
        type: string,
        amount: number,
        input: {
          idempotencyKey?: string | null;
          reason?: string | null;
          metadata?: Record<string, unknown> | null;
        },
      ) => {
        writes.push({
          type,
          amount,
          key: input.idempotencyKey,
          reason: input.reason,
          metadata: input.metadata,
        });
        wallet.balanceVnd += amount;
        return Promise.resolve({});
      },
    ),
    partnerRepository: { find: jest.fn().mockResolvedValue([row]) },
    dataSource: {
      transaction: (fn: (m: unknown) => unknown) => fn(manager),
      query: jest.fn().mockResolvedValue(ledger),
    },
    mailService: { sendPartnerCreditStatement },
  });
  return { service, writes, updates, wallet, sendPartnerCreditStatement };
}

describe('setting the credit limit (vande #056)', () => {
  it('should fill the wallet to the limit when switched on', async () => {
    const { service, writes, updates, wallet } = buildService();

    await service.setCreditLimit(
      11,
      { noDepositRequired: true, creditLimitVnd: 100_000_000 },
      1,
    );

    expect(writes).toEqual([
      expect.objectContaining({
        type: PartnerWalletTransactionTypeEnum.CREDIT_LIMIT_RESET,
        amount: 100_000_000,
      }),
    ]);
    expect(wallet.balanceVnd).toBe(100_000_000);
    expect(updates[0]).toEqual({
      noDepositRequired: true,
      creditLimitVnd: 100_000_000,
    });
  });

  it('should refuse while the partner still holds their own deposit', async () => {
    // Their money would be mixed into the credit and billed back to them.
    const { service, writes } = buildService({ balanceVnd: 5_000_000 });

    await expect(
      service.setCreditLimit(
        11,
        { noDepositRequired: true, creditLimitVnd: 100_000_000 },
        1,
      ),
    ).rejects.toThrow(/còn 5\.000\.000đ ký quỹ/);
    expect(writes).toHaveLength(0);
  });

  it('should move the wallet only by the change of limit, keeping what was spent', async () => {
    // 100M limit, 30M spent → 70M left; raised to 150M → 120M left, not 150M.
    const { service, wallet } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
      balanceVnd: 70_000_000,
    });

    await service.setCreditLimit(
      11,
      { noDepositRequired: true, creditLimitVnd: 150_000_000 },
      1,
    );

    expect(wallet.balanceVnd).toBe(120_000_000);
  });

  it('should take back the unspent credit when switched off', async () => {
    const { service, wallet, updates } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
      balanceVnd: 70_000_000,
    });

    await service.setCreditLimit(11, { noDepositRequired: false }, 1);

    expect(wallet.balanceVnd).toBe(0);
    expect(updates[0]).toEqual({ noDepositRequired: false, creditLimitVnd: 0 });
  });

  it('should mark where credit stopped, for the statement', async () => {
    const { writes } = await (async () => {
      const built = buildService({
        partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
        balanceVnd: 70_000_000,
      });
      await built.service.setCreditLimit(11, { noDepositRequired: false }, 1);
      return built;
    })();
    expect(writes[0].metadata).toEqual({ creditOff: true });
  });

  it('should still mark it when the limit was used up', async () => {
    // Nothing to take back, yet purchases after this are paid from a deposit
    // and must not be billed as credit.
    const { service, writes, wallet } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
      balanceVnd: 0,
    });

    await service.setCreditLimit(11, { noDepositRequired: false }, 1);

    expect(writes).toEqual([
      expect.objectContaining({
        type: PartnerWalletTransactionTypeEnum.CREDIT_LIMIT_RESET,
        amount: 0,
        metadata: { creditOff: true },
      }),
    ]);
    expect(wallet.balanceVnd).toBe(0);
  });

  it('should not combine with the affiliate programme', async () => {
    // Commission paid into the wallet would be swallowed by the refill.
    const { service } = buildService({ partner: { canAffiliate: true } });
    await expect(
      service.setCreditLimit(
        11,
        { noDepositRequired: true, creditLimitVnd: 1_000_000 },
        1,
      ),
    ).rejects.toThrow(/affiliate/);
    await expect(
      buildService({
        partner: { noDepositRequired: true, creditLimitVnd: 1_000_000 },
      }).service.setAffiliateGrant(11, true),
    ).rejects.toThrow(/Không cần ký quỹ/);
  });

  it('should not let the credit be withdrawn', async () => {
    const { service } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 1_000_000 },
    });
    await expect(
      service.createPayoutRequest(11, { amountVnd: 500_000 } as never),
    ).rejects.toThrow(/không rút được/);
  });

  it('should not tell a partner on credit to top up when the limit runs out', async () => {
    const { service } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 1_000_000 },
      balanceVnd: 100_000,
    });
    Object.assign(service, {
      partnerRepository: {
        findOne: jest.fn().mockResolvedValue({ noDepositRequired: true }),
      },
    });

    await expect(
      service.debitWalletForPurchase(11, {
        orderId: 1,
        orderNumber: 'PTN-1',
        amountVnd: 300_000,
      }),
    ).rejects.toThrow(/đặt lại lúc 0h ngày 1/);
  });

  it('should need a limit above zero', async () => {
    const { service } = buildService();
    await expect(
      service.setCreditLimit(
        11,
        { noDepositRequired: true, creditLimitVnd: 0 },
        1,
      ),
    ).rejects.toThrow(/lớn hơn 0/);
  });

  it('should not apply to a marketing partner', async () => {
    const { service } = buildService({
      partner: { partnerType: PartnerTypeEnum.KOL },
    });
    await expect(
      service.setCreditLimit(
        11,
        { noDepositRequired: true, creditLimitVnd: 1_000_000 },
        1,
      ),
    ).rejects.toThrow(/tiếp thị/);
  });
});

describe('the 0h reset on the 1st (vande #056)', () => {
  it('should bring the wallet back to the limit, whatever was spent', async () => {
    const { service, writes, wallet } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
      balanceVnd: 12_500_000,
    });

    await service.resetCreditLimits('2026-11');

    expect(wallet.balanceVnd).toBe(100_000_000);
    expect(writes[0]).toMatchObject({
      type: PartnerWalletTransactionTypeEnum.CREDIT_LIMIT_RESET,
      amount: 87_500_000,
      // One line per partner per month: a second run is a no-op.
      key: 'credit_limit_reset:11:2026-11',
    });
  });

  it('should also take back credit that grew above the limit', async () => {
    // A refund on the last day put the wallet over the limit.
    const { service, wallet } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
      balanceVnd: 101_000_000,
    });

    await service.resetCreditLimits('2026-11');

    expect(wallet.balanceVnd).toBe(100_000_000);
  });

  it('should write nothing when nothing was spent', async () => {
    const { service, writes } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
      balanceVnd: 100_000_000,
    });

    await service.resetCreditLimits('2026-11');

    expect(writes).toHaveLength(0);
  });

  it('should ask only for active no-deposit partners', async () => {
    const { service } = buildService();
    await service.resetCreditLimits('2026-11');
    const find = (
      service as unknown as { partnerRepository: { find: jest.Mock } }
    ).partnerRepository.find;
    expect(find).toHaveBeenCalledWith({
      where: { noDepositRequired: true, status: 'active' },
    });
  });

  it('should run at 0h on the 1st, Vietnam time', () => {
    const meta = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      PartnersService.prototype.resetCreditLimits,
    );
    expect(meta).toMatchObject({
      cronTime: '0 0 1 * *',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  });
});

describe('the monthly statement (vande #056)', () => {
  const ledger = [
    {
      type: 'order_purchase',
      amountVnd: '-3000000',
      createdAt: new Date('2026-10-03T02:00:00Z'),
      orderNumber: 'ORD-1',
      deliveryEmail: 'khach1@example.com',
      products: 'Nhật Bản 5GB x 10',
      esims: 10,
    },
    {
      type: 'order_purchase',
      amountVnd: '-1200000',
      createdAt: new Date('2026-10-20T02:00:00Z'),
      orderNumber: 'ORD-2',
      deliveryEmail: 'khach2@example.com',
      products: 'Hàn Quốc 3GB x 4',
      esims: 4,
    },
    {
      type: 'order_purchase_reversal',
      amountVnd: '300000',
      createdAt: new Date('2026-10-21T02:00:00Z'),
      orderNumber: 'ORD-2',
      deliveryEmail: 'khach2@example.com',
      products: 'Hàn Quốc 3GB x 4',
      esims: 4,
    },
  ];

  it('should owe the purchases less what was given back', async () => {
    const { service } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
      ledger,
    });

    const statement = await service.creditStatement(11, '2026-10');

    expect(statement).toMatchObject({
      periodLabel: 'Tháng 10/2026',
      orderCount: 2,
      esimCount: 14,
      purchasedVnd: 4_200_000,
      refundedVnd: 300_000,
      amountDueVnd: 3_900_000,
    });
    // The detail lines add up to the same figure the email asks for.
    expect(statement.lines.reduce((sum, l) => sum + l.amountVnd, 0)).toBe(
      3_900_000,
    );
    expect(statement.lines[2]).toMatchObject({
      status: 'Hoàn tiền',
      amountVnd: -300_000,
    });
  });

  it('should cut the month on Hanoi midnight off the wallet ledger', async () => {
    const { service } = buildService({ ledger });
    await service.creditStatement(11, '2026-10');
    const [sql, params] = (
      service as unknown as { dataSource: { query: jest.Mock } }
    ).dataSource.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('partner_wallet_transaction');
    // Only what was bought while on credit, not from a deposit.
    expect(sql).toContain(`r.metadata->>'creditOff'`);
    expect(sql).toContain(`AT TIME ZONE 'Asia/Ho_Chi_Minh'`);
    expect(params).toEqual([11, '2026-10-01']);
  });

  it('should email the statement with the detail file attached', async () => {
    const { service, sendPartnerCreditStatement } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
      ledger,
    });

    await service.sendCreditStatements('2026-10');

    expect(sendPartnerCreditStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'son@example.com',
        periodLabel: 'Tháng 10/2026',
        amountDueVnd: 3_900_000,
        attachment: expect.objectContaining({
          filename: expect.stringMatching(
            /^Chi-tiet-giao-dich-2026-10-doi-tac-11/,
          ),
        }),
      }),
    );
  });

  it('should not email a month with nothing bought on credit', async () => {
    const { service, sendPartnerCreditStatement } = buildService({
      partner: { noDepositRequired: true, creditLimitVnd: 100_000_000 },
    });

    await service.sendCreditStatements('2026-10');

    expect(sendPartnerCreditStatement).not.toHaveBeenCalled();
  });
});
