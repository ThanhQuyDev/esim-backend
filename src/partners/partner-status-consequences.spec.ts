import { BadRequestException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import {
  PartnerLinkStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
  PartnerWalletStatusEnum,
} from './partners.enum';
import type { PartnerEntity } from './infrastructure/persistence/relational/entities/partner.entity';
import {
  PARTNER_DEPOSIT_MAX_VND,
  PARTNER_DEPOSIT_MIN_VND,
} from './partners.constants';

/**
 * What locking a partner actually does (#061).
 *
 * The status is not a label. "Tạm khoá" freezes the money and stops the partner
 * trading; "khoá tài khoản" additionally signs them out everywhere, because an
 * open tab is otherwise a way back into a locked account and they keep selling
 * until the session happens to expire.
 */

function buildService(partner: Partial<PartnerEntity>) {
  const full = {
    id: 8,
    userId: 100,
    partnerType: PartnerTypeEnum.KOL,
    status: PartnerStatusEnum.ACTIVE,
    canAffiliate: false,
    ...partner,
  } as PartnerEntity;

  const walletUpdate = jest.fn().mockResolvedValue(undefined);
  const query = jest.fn().mockResolvedValue([]);
  const statusSave = jest
    .fn()
    .mockImplementation((row) => Promise.resolve(row));

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    adminFindById: jest.fn().mockResolvedValue(full),
    partnerRepository: {
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
    },
    walletRepository: { update: walletUpdate },
    statusChangeRepository: { create: (r: unknown) => r, save: statusSave },
    dataSource: { query },
  });

  return { service, walletUpdate, query, statusSave };
}

describe('PartnersService.updateStatus — tạm khoá (#061)', () => {
  it('should freeze the wallet', async () => {
    const { service, walletUpdate } = buildService({});

    await service.updateStatus(
      8,
      { status: PartnerStatusEnum.HOLD },
      1,
      'Nghi ngờ',
    );

    expect(walletUpdate).toHaveBeenCalledWith(
      { partnerId: 8 },
      { status: PartnerWalletStatusEnum.LOCKED },
    );
  });

  it('should suspend a marketing partner’s links and codes, remembering each link’s state', async () => {
    // "Bị đình chỉ" (doitac-1410 #004), not "tắt": unlocking must give back
    // what the partner had chosen.
    const { service, query } = buildService({});

    await service.updateStatus(
      8,
      { status: PartnerStatusEnum.HOLD },
      1,
      'Nghi ngờ',
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('"statusBeforeSuspend" = status'),
      [8, PartnerLinkStatusEnum.SUSPENDED],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE coupon SET "suspendedAt" = now()'),
      [8],
    );
  });

  it('should leave a distributor’s links alone unless they run the programme', async () => {
    // A distributor without the affiliate grant (#048) has no links to stop.
    const { service, query } = buildService({
      partnerType: PartnerTypeEnum.DISTRIBUTION,
      canAffiliate: false,
    });

    await service.updateStatus(
      8,
      { status: PartnerStatusEnum.HOLD },
      1,
      'Nghi ngờ',
    );

    expect(query).not.toHaveBeenCalled();
  });

  it('should not sign them out — a hold is not a lock', async () => {
    const { service, query } = buildService({});

    await service.updateStatus(
      8,
      { status: PartnerStatusEnum.HOLD },
      1,
      'Nghi ngờ',
    );

    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM session'),
      ),
    ).toBe(false);
  });

  it('should demand a reason', async () => {
    const { service } = buildService({});

    await expect(
      service.updateStatus(8, { status: PartnerStatusEnum.HOLD }, 1),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('PartnersService.updateStatus — khoá tài khoản (#061)', () => {
  it('should sign the partner out everywhere', async () => {
    // An open tab must not be a way back into a locked account.
    const { service, query } = buildService({});

    await service.updateStatus(
      8,
      { status: PartnerStatusEnum.DISABLED },
      1,
      'Gian lận',
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM session'),
      [100],
    );
  });

  it('should freeze the wallet as well', async () => {
    const { service, walletUpdate } = buildService({});

    await service.updateStatus(
      8,
      { status: PartnerStatusEnum.DISABLED },
      1,
      'Gian lận',
    );

    expect(walletUpdate).toHaveBeenCalledWith(
      { partnerId: 8 },
      { status: PartnerWalletStatusEnum.LOCKED },
    );
  });
});

describe('PartnersService.updateStatus — mở khoá (#061)', () => {
  it('should put the wallet and the links back', async () => {
    const { service, walletUpdate, query } = buildService({
      status: PartnerStatusEnum.HOLD,
    });

    await service.updateStatus(8, { status: PartnerStatusEnum.ACTIVE }, 1);

    expect(walletUpdate).toHaveBeenCalledWith(
      { partnerId: 8 },
      { status: PartnerWalletStatusEnum.ACTIVE },
    );
    // Each link goes back to what the partner had, not all to "active".
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE("statusBeforeSuspend", $3)'),
      [8, PartnerLinkStatusEnum.SUSPENDED, PartnerLinkStatusEnum.ACTIVE],
    );
  });

  it('should not ask why somebody is getting their account back', async () => {
    const { service } = buildService({ status: PartnerStatusEnum.DISABLED });

    await expect(
      service.updateStatus(8, { status: PartnerStatusEnum.ACTIVE }, 1),
    ).resolves.toMatchObject({ status: PartnerStatusEnum.ACTIVE });
  });

  it('should do nothing at all when the status has not moved', async () => {
    const { service, walletUpdate, statusSave } = buildService({
      status: PartnerStatusEnum.ACTIVE,
    });

    await service.updateStatus(8, { status: PartnerStatusEnum.ACTIVE }, 1);

    expect(walletUpdate).not.toHaveBeenCalled();
    expect(statusSave).not.toHaveBeenCalled();
  });
});

describe('PartnersService.depositLimitsFor (#061)', () => {
  /**
   * The programme default is now a row an admin edits rather than a constant
   * (#075), so the limits are read asynchronously and the default differs by
   * partner type.
   */
  function buildLimitsService(settings: Record<string, number> = {}) {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      programSettingRepository: {
        findOne: jest.fn().mockResolvedValue({
          depositMinKolVnd: PARTNER_DEPOSIT_MIN_VND,
          depositMinDistributionVnd: PARTNER_DEPOSIT_MIN_VND,
          ...settings,
        }),
      },
    });
    return service;
  }

  it('should fall back to the programme default', async () => {
    const service = buildLimitsService();

    await expect(
      service.depositLimitsFor({
        partnerType: 'kol',
        depositMinVnd: null,
        depositMaxVnd: null,
      } as PartnerEntity),
    ).resolves.toEqual({
      minVnd: PARTNER_DEPOSIT_MIN_VND,
      maxVnd: PARTNER_DEPOSIT_MAX_VND,
    });
  });

  it('should read the default for the partner’s own type', async () => {
    // A distribution partner's floor is a different decision from a marketing
    // partner's, so the settings row carries one of each (#075).
    const service = buildLimitsService({
      depositMinDistributionVnd: 2_000_000,
    });

    await expect(
      service.depositLimitsFor({
        partnerType: 'distribution',
        depositMinVnd: null,
        depositMaxVnd: null,
      } as PartnerEntity),
    ).resolves.toMatchObject({ minVnd: 2_000_000 });
  });

  it('should use the partner’s own limits when they have been given any', async () => {
    // A distributor turning over hundreds of millions should not have to top up
    // ten million at a time.
    const service = buildLimitsService();

    await expect(
      service.depositLimitsFor({
        partnerType: 'distribution',
        depositMinVnd: 1_000_000,
        depositMaxVnd: 500_000_000,
      } as PartnerEntity),
    ).resolves.toEqual({ minVnd: 1_000_000, maxVnd: 500_000_000 });
  });
});
