import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * The partner programme's own settings (#075, #076, #077).
 *
 * These were constants in the source, which made changing a minimum
 * withdrawal a deploy. They are also not one number each: what a marketing
 * partner may withdraw and what a distribution partner must keep on deposit
 * are separate decisions.
 */

const DEFAULTS = {
  id: 1,
  payoutMinKolVnd: 50_000,
  payoutMinDistributionVnd: 50_000,
  depositMinKolVnd: 100_000,
  depositMinDistributionVnd: 100_000,
  lowDepositWarningVnd: 500_000,
  reconciliationEmailEnabled: false,
  reconciliationEmailDayOfMonth: 5,
};

function buildService(
  stored: Record<string, unknown> | null = { ...DEFAULTS },
) {
  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const findOne = jest.fn().mockResolvedValue(stored);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    programSettingRepository: { findOne, save, create: (row: unknown) => row },
  });
  return { service, save, findOne };
}

describe('PartnersService.getProgramSettings (#075)', () => {
  it('should return the settings that are stored', async () => {
    const { service } = buildService();

    const settings = await service.getProgramSettings();

    expect(settings.payoutMinKolVnd).toBe(50_000);
  });

  it('should create the row rather than throw when it is missing', async () => {
    // A database that somehow missed the seed should still take a withdrawal.
    const { service, save } = buildService(null);

    await service.getProgramSettings();

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

describe('PartnersService.updateProgramSettings (#075, #076, #077)', () => {
  it('should change only the fields that were sent', async () => {
    const { service, save } = buildService();

    await service.updateProgramSettings({ payoutMinKolVnd: 200_000 }, 3);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutMinKolVnd: 200_000,
        // Untouched, not reset to a default.
        depositMinKolVnd: 100_000,
        updatedByAdminId: 3,
      }),
    );
  });

  it('should cap the statement day at the 28th', async () => {
    // A statement due on the 30th would silently skip February.
    const { service, save } = buildService();

    await service.updateProgramSettings(
      { reconciliationEmailDayOfMonth: 31 },
      3,
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ reconciliationEmailDayOfMonth: 28 }),
    );
  });

  it('should refuse a statement day before the first', async () => {
    const { service, save } = buildService();

    await service.updateProgramSettings(
      { reconciliationEmailDayOfMonth: 0 },
      3,
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ reconciliationEmailDayOfMonth: 1 }),
    );
  });

  it('should allow a zero threshold rather than read it as "unset"', async () => {
    // "Không giới hạn" is a real choice, and `?? default` would have eaten it.
    const { service, save } = buildService();

    await service.updateProgramSettings({ lowDepositWarningVnd: 0 }, 3);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ lowDepositWarningVnd: 0 }),
    );
  });
});

describe('PartnersService.payoutMinVndFor (#075)', () => {
  it('should give each partner type its own floor', async () => {
    const { service } = buildService({
      ...DEFAULTS,
      payoutMinKolVnd: 50_000,
      payoutMinDistributionVnd: 1_000_000,
    });

    await expect(service.payoutMinVndFor(PartnerTypeEnum.KOL)).resolves.toBe(
      50_000,
    );
    await expect(
      service.payoutMinVndFor(PartnerTypeEnum.DISTRIBUTION),
    ).resolves.toBe(1_000_000);
  });
});

describe('PartnersService.sendScheduledReconciliationEmails (#076)', () => {
  function buildCronService(settings: Record<string, unknown>) {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const sendPartnerReconciliationStatement = jest
      .fn()
      .mockResolvedValue(undefined);
    const adminListReconciliations = jest.fn().mockResolvedValue({
      period: '2026-08',
      rows: [
        {
          partnerId: 8,
          contactName: 'Nguyễn Văn A',
          contactEmail: 'a@example.com',
          validOrders: 40,
          esimsSold: 52,
          viaCouponPercent: 25,
          revenueVnd: 120_000_000,
          commissionVnd: 18_000_000,
        },
        // No address on file: nothing to send to, and not a failure either.
        {
          partnerId: 9,
          contactName: null,
          contactEmail: null,
          validOrders: 1,
          esimsSold: 1,
          viaCouponPercent: 0,
          revenueVnd: 1,
          commissionVnd: 1,
        },
      ],
    });

    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      programSettingRepository: {
        findOne: jest.fn().mockResolvedValue({ ...DEFAULTS, ...settings }),
      },
      mailService: { sendPartnerReconciliationStatement },
      adminListReconciliations,
    });
    return {
      service,
      sendPartnerReconciliationStatement,
      adminListReconciliations,
    };
  }

  it('should send nothing while the schedule is switched off', async () => {
    const { service, sendPartnerReconciliationStatement } = buildCronService({
      reconciliationEmailEnabled: false,
    });

    await service.sendScheduledReconciliationEmails();

    expect(sendPartnerReconciliationStatement).not.toHaveBeenCalled();
  });

  it('should send nothing on a day that is not the chosen one', async () => {
    // The cron runs daily; the schedule is the setting, not the cron.
    const today = new Date().getDate();
    const { service, sendPartnerReconciliationStatement } = buildCronService({
      reconciliationEmailEnabled: true,
      reconciliationEmailDayOfMonth: today === 1 ? 2 : 1,
    });

    await service.sendScheduledReconciliationEmails();

    expect(sendPartnerReconciliationStatement).not.toHaveBeenCalled();
  });

  it('should send the month that just ended, not the one running', async () => {
    const today = new Date();
    const { service, adminListReconciliations } = buildCronService({
      reconciliationEmailEnabled: true,
      reconciliationEmailDayOfMonth: today.getDate(),
    });

    await service.sendScheduledReconciliationEmails();

    const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const expected = `${previous.getFullYear()}-${String(
      previous.getMonth() + 1,
    ).padStart(2, '0')}`;
    expect(adminListReconciliations).toHaveBeenCalledWith({ period: expected });
  });

  it('should skip a partner with no address rather than fail the run', async () => {
    const today = new Date();
    const { service, sendPartnerReconciliationStatement } = buildCronService({
      reconciliationEmailEnabled: true,
      reconciliationEmailDayOfMonth: today.getDate(),
    });

    await service.sendScheduledReconciliationEmails();

    expect(sendPartnerReconciliationStatement).toHaveBeenCalledTimes(1);
    expect(sendPartnerReconciliationStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        commissionVnd: 18_000_000,
      }),
    );
  });

  it("should carry on after one partner's email fails", async () => {
    // One address bouncing is one partner's email, not the whole run's.
    const today = new Date();
    const { service, sendPartnerReconciliationStatement } = buildCronService({
      reconciliationEmailEnabled: true,
      reconciliationEmailDayOfMonth: today.getDate(),
    });
    sendPartnerReconciliationStatement.mockRejectedValueOnce(
      new Error('smtp down'),
    );

    await expect(
      service.sendScheduledReconciliationEmails(),
    ).resolves.toBeUndefined();
  });
});
