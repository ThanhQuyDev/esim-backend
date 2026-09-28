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
  const linkUpdate = jest.fn().mockResolvedValue(undefined);
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
    linkRepository: { update: linkUpdate },
    statusChangeRepository: { create: (r: unknown) => r, save: statusSave },
    dataSource: { query },
  });

  return { service, walletUpdate, linkUpdate, query, statusSave };
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

  it('should switch off a marketing partner’s links', async () => {
    const { service, linkUpdate } = buildService({});

    await service.updateStatus(
      8,
      { status: PartnerStatusEnum.HOLD },
      1,
      'Nghi ngờ',
    );

    expect(linkUpdate).toHaveBeenCalledWith(
      { partnerId: 8 },
      { status: PartnerLinkStatusEnum.INACTIVE },
    );
  });

  it('should leave a distributor’s links alone unless they run the programme', async () => {
    // A distributor without the affiliate grant (#048) has no links to stop.
    const { service, linkUpdate } = buildService({
      partnerType: PartnerTypeEnum.DISTRIBUTION,
      canAffiliate: false,
    });

    await service.updateStatus(
      8,
      { status: PartnerStatusEnum.HOLD },
      1,
      'Nghi ngờ',
    );

    expect(linkUpdate).not.toHaveBeenCalled();
  });

  it('should not sign them out — a hold is not a lock', async () => {
    const { service, query } = buildService({});

    await service.updateStatus(
      8,
      { status: PartnerStatusEnum.HOLD },
      1,
      'Nghi ngờ',
    );

    expect(query).not.toHaveBeenCalled();
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

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('DELETE FROM session');
    expect(params).toEqual([100]);
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
    const { service, walletUpdate, linkUpdate } = buildService({
      status: PartnerStatusEnum.HOLD,
    });

    await service.updateStatus(8, { status: PartnerStatusEnum.ACTIVE }, 1);

    expect(walletUpdate).toHaveBeenCalledWith(
      { partnerId: 8 },
      { status: PartnerWalletStatusEnum.ACTIVE },
    );
    expect(linkUpdate).toHaveBeenCalledWith(
      { partnerId: 8 },
      { status: PartnerLinkStatusEnum.ACTIVE },
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
  it('should fall back to the programme default', () => {
    const { service } = buildService({});

    expect(
      service.depositLimitsFor({
        depositMinVnd: null,
        depositMaxVnd: null,
      } as PartnerEntity),
    ).toEqual({
      minVnd: PARTNER_DEPOSIT_MIN_VND,
      maxVnd: PARTNER_DEPOSIT_MAX_VND,
    });
  });

  it('should use the partner’s own limits when they have been given any', () => {
    // A distributor turning over hundreds of millions should not have to top up
    // ten million at a time.
    const { service } = buildService({});

    expect(
      service.depositLimitsFor({
        depositMinVnd: 1_000_000,
        depositMaxVnd: 500_000_000,
      } as PartnerEntity),
    ).toEqual({ minVnd: 1_000_000, maxVnd: 500_000_000 });
  });
});
