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
    pendingCommission = 0,
    paidPayout = 0,
  } = {}) {
    /** Fake query builder that answers based on the status asked for. */
    function sumBuilder(byStatus: Record<string, number>) {
      let status = '';
      const builder = {
        select: () => builder,
        where: () => builder,
        andWhere: (_clause: string, params: { status: string }) => {
          status = params.status;
          return builder;
        },
        getRawOne: () =>
          Promise.resolve({ sum: String(byStatus[status] ?? 0) }),
      };
      return builder;
    }

    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      getOrCreateWallet: jest
        .fn()
        .mockResolvedValue({ balanceVnd, status: 'active' }),
      payoutRepository: {
        createQueryBuilder: () =>
          sumBuilder({
            [PartnerPayoutStatusEnum.PENDING]: pendingPayout,
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
});
