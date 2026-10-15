import { PartnersService } from './partners.service';
import {
  OrderPartnerCommissionStatusEnum,
  PartnerPayoutStatusEnum,
} from './partners.enum';

/**
 * The partner's money in the three buckets the brief names (#095, ý 2):
 * "Chờ đối soát - Khả dụng - Đã rút luỹ kế".
 *
 * Only two existed, and one of them was easy to misread: `pendingPayoutVnd` is
 * money already claimed in a withdrawal request, NOT commission awaiting
 * reconciliation. A partner with millions in unreconciled commission saw 0đ
 * everywhere and could only conclude they had been paid for nothing.
 */
describe('PartnersService — partner wallet summary', () => {
  function buildService({
    balanceVnd = 0,
    pendingPayout = 0,
    approvedPayout = 0,
    pendingCommission = 0,
    paidPayout = 0,
  } = {}) {
    /** Fake query builder that answers based on the status asked for. */
    function sumBuilder(byStatus: Record<string, number>) {
      let statuses: string[] = [];
      const builder = {
        select: () => builder,
        // The paid-payout query also counts the payments (#029).
        addSelect: () => builder,
        where: () => builder,
        // One status, or a list of them (doitac-1410 #005).
        andWhere: (
          _clause: string,
          params: { status?: string; statuses?: string[] },
        ) => {
          statuses = params.statuses ?? [params.status ?? ''];
          return builder;
        },
        getRawOne: () => {
          const sum = statuses.reduce((t, st) => t + (byStatus[st] ?? 0), 0);
          return Promise.resolve({ sum: String(sum), count: sum ? '1' : '0' });
        },
      };
      return builder;
    }

    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      // The programme's thresholds now live in a settings row (#075).
      programSettingRepository: {
        findOne: jest.fn().mockResolvedValue({
          payoutMinKolVnd: 50_000,
          payoutMinDistributionVnd: 50_000,
          depositMinKolVnd: 100_000,
          depositMinDistributionVnd: 100_000,
          lowDepositWarningVnd: 500_000,
        }),
      },
      getOrCreateWallet: jest
        .fn()
        .mockResolvedValue({ balanceVnd, status: 'active' }),
      // The summary now publishes this partner's own top-up limits (#061).
      getPartnerOrThrowById: jest
        .fn()
        .mockResolvedValue({ id: 5, depositMinVnd: null, depositMaxVnd: null }),

      payoutRepository: {
        createQueryBuilder: () =>
          sumBuilder({
            [PartnerPayoutStatusEnum.PENDING]: pendingPayout,
            [PartnerPayoutStatusEnum.APPROVED]: approvedPayout,
            [PartnerPayoutStatusEnum.PAID]: paidPayout,
          }),
      },
      commissionRepository: {
        createQueryBuilder: () =>
          sumBuilder({
            [OrderPartnerCommissionStatusEnum.PENDING]: pendingCommission,
          }),
      },
    });

    return service;
  }

  it('should report all three buckets separately', async () => {
    const service = buildService({
      balanceVnd: 1_200_000,
      pendingPayout: 200_000,
      pendingCommission: 450_000,
      paidPayout: 3_000_000,
    });

    const summary = await service.getWalletSummaryForPartner(5);

    expect(summary).toMatchObject({
      // Credited, minus what a withdrawal request has already claimed.
      availableBalanceVnd: 1_000_000,
      pendingCommissionVnd: 450_000,
      withdrawnVnd: 3_000_000,
    });
  });

  it('should not confuse unreconciled commission with a pending withdrawal', async () => {
    const service = buildService({
      balanceVnd: 0,
      pendingPayout: 0,
      pendingCommission: 800_000,
    });

    const summary = await service.getWalletSummaryForPartner(5);

    // The old summary reported 0đ across the board here, which reads as "you
    // have earned nothing" to somebody who has earned 800k.
    expect(summary.pendingCommissionVnd).toBe(800_000);
    expect(summary.pendingPayoutVnd).toBe(0);
    expect(summary.availableBalanceVnd).toBe(0);
  });

  it('should never show a negative available balance', async () => {
    // A payout approved for the full balance, then a clawback: the arithmetic
    // goes negative and "-50.000đ khả dụng" is not something to show anyone.
    const service = buildService({
      balanceVnd: 100_000,
      pendingPayout: 150_000,
    });

    const summary = await service.getWalletSummaryForPartner(5);

    expect(summary.availableBalanceVnd).toBe(0);
  });

  it('should report zeroes for a partner who has earned nothing yet', async () => {
    const service = buildService();

    const summary = await service.getWalletSummaryForPartner(5);

    expect(summary).toMatchObject({
      availableBalanceVnd: 0,
      pendingCommissionVnd: 0,
      withdrawnVnd: 0,
    });
  });

  it('should keep an approved withdrawal held until it is paid (doitac-1410 #005)', async () => {
    // Approving used to hand the money back, so the partner could ask for it
    // again before the transfer was recorded.
    const service = buildService({
      balanceVnd: 500_000,
      pendingPayout: 100_000,
      approvedPayout: 300_000,
    });

    const summary = await service.getWalletSummaryForPartner(5);

    expect(summary.pendingPayoutVnd).toBe(400_000);
    expect(summary.availableBalanceVnd).toBe(100_000);
  });
});
