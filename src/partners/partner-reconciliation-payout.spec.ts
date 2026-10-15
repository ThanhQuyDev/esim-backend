import { PartnersService } from './partners.service';

/**
 * Sending a month's statement raises that month's withdrawal, for the amount
 * at closing (doitac-1410 #012).
 */
function buildService(
  opts: {
    partner?: Record<string, unknown>;
    available?: number;
    walletStatus?: string;
    existing?: boolean;
  } = {},
) {
  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 9,
      partnerType: 'kol',
      status: 'active',
      bankName: 'VCB',
      bankAccountNumber: '0123',
      bankAccountHolder: 'NGUYEN VAN A',
      ...opts.partner,
    }),
    getWalletSummaryForPartner: jest.fn().mockResolvedValue({
      availableBalanceVnd: opts.available ?? 500_000,
      status: opts.walletStatus ?? 'active',
    }),
    payoutRepository: {
      findOne: jest.fn().mockResolvedValue(opts.existing ? { id: 1 } : null),
      create: (row: unknown) => row,
      save,
    },
  });
  return { service, save };
}

describe('PartnersService.raisePayoutForReconciliation (doitac-1410 #012)', () => {
  it('should raise a pending withdrawal for the month, marked with the month', async () => {
    const { service, save } = buildService();

    await service.raisePayoutForReconciliation(9, '2026-09', 320_000);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 9,
        amountVnd: 320_000,
        status: 'pending',
        reconciliationPeriod: '2026-09',
        bankAccountNumber: '0123',
      }),
    );
  });

  it('should never ask for more than can be withdrawn now', async () => {
    // An older debt is paid off first.
    const { service, save } = buildService({ available: 200_000 });

    await service.raisePayoutForReconciliation(9, '2026-09', 320_000);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ amountVnd: 200_000 }),
    );
  });

  it('should not raise the same month twice', async () => {
    const { service, save } = buildService({ existing: true });

    await service.raisePayoutForReconciliation(9, '2026-09', 320_000);

    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    ['a held account', { partner: { status: 'hold' } }],
    ['a frozen wallet', { walletStatus: 'locked' }],
    ['nothing to withdraw', { available: 0 }],
    [
      'a distribution partner without the programme',
      { partner: { partnerType: 'distribution', canAffiliate: false } },
    ],
  ])('should raise nothing for %s', async (_label, opts) => {
    const { service, save } = buildService(opts);

    await service.raisePayoutForReconciliation(9, '2026-09', 320_000);

    expect(save).not.toHaveBeenCalled();
  });
});
