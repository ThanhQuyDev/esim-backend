import { BadRequestException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';
import type { PartnerEntity } from './infrastructure/persistence/relational/entities/partner.entity';

/**
 * The affiliate programme as a grant (#048).
 *
 * "Các menu: Link tiếp thị, mã giảm giá, hoa hồng, rút tiền sẽ chỉ hiện ra khi
 * đối tác phân phối được phân quyền affiliate."
 *
 * Hiding the menus is not the rule, it is the appearance of the rule: a stale
 * tab or a direct call would still create a link. So the refusal lives on the
 * server, and the four actions ask for the grant before doing anything.
 */

function buildService(partner: Partial<PartnerEntity>) {
  const full = {
    id: 8,
    userId: 100,
    partnerType: PartnerTypeEnum.DISTRIBUTION,
    canAffiliate: false,
    tierCode: 'SILVER',
    ...partner,
  } as PartnerEntity;

  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
    partnerRepository: { findOne: jest.fn().mockResolvedValue(full), save },
    getPartnerOrThrowById: jest.fn().mockResolvedValue(full),
    adminFindById: jest.fn().mockResolvedValue(full),
    linkRepository: {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
      create: (row: unknown) => row,
      count: jest.fn().mockResolvedValue(0),
    },
    tierRepository: {
      findOne: jest.fn().mockResolvedValue({ maxDiscountPercent: 10 }),
    },
    getWalletSummaryForPartner: jest
      .fn()
      .mockResolvedValue({ availableBalanceVnd: 10_000_000 }),
  });

  return { service, save };
}

describe('PartnersService.setAffiliateGrant (#048)', () => {
  it('should turn the programme on for a distribution partner', async () => {
    const { service, save } = buildService({});

    await service.setAffiliateGrant(8, true);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 8, canAffiliate: true }),
    );
  });

  it('should turn it back off again', async () => {
    const { service, save } = buildService({ canAffiliate: true });

    await service.setAffiliateGrant(8, false);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ canAffiliate: false }),
    );
  });
});

describe('Affiliate actions ask for the grant (#048)', () => {
  it('should refuse a link to a distributor without the grant', async () => {
    const { service } = buildService({ canAffiliate: false });

    await expect(
      service.createLink(8, {
        label: 'Thử',
        targetPath: '/esim/japan',
      } as never),
    ).rejects.toThrow(/chưa được cấp quyền tiếp thị/);
  });

  it('should allow a link once the grant is on', async () => {
    const { service } = buildService({ canAffiliate: true });

    await expect(
      service.createLink(8, {
        label: 'Thử',
        targetPath: '/esim/japan',
      } as never),
    ).resolves.toBeDefined();
  });

  it('should refuse a discount code to a distributor without the grant', async () => {
    const { service } = buildService({ canAffiliate: false });

    await expect(
      service.createMyCoupon(8, {
        code: 'PHANPHOI10',
        discountPercent: 5,
      } as never),
    ).rejects.toThrow(/chưa được cấp quyền tiếp thị/);
  });

  it('should refuse a withdrawal to a distributor without the grant', async () => {
    // Their ký quỹ balance is there to buy stock with, not to withdraw.
    const { service } = buildService({ canAffiliate: false });

    await expect(
      service.createPayoutRequest(8, { amountVnd: 200_000 } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('should never ask a marketing partner for a grant', async () => {
    // They are the affiliate programme; the flag is not their question.
    const { service } = buildService({
      partnerType: PartnerTypeEnum.KOL,
      canAffiliate: false,
    });

    await expect(
      service.createLink(8, {
        label: 'Thử',
        targetPath: '/esim/japan',
      } as never),
    ).resolves.toBeDefined();
  });
});
