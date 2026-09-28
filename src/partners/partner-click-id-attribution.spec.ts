import { PartnersService } from './partners.service';
import {
  PartnerLinkStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
} from './partners.enum';

/**
 * Attribution that does not depend on a cookie (#039).
 *
 * Safari and iOS cap a script-written cookie at a week or less, well short of
 * the window a partner is promised. So the server mints an id at the click, the
 * redirect carries it in the URL, and the checkout hands it back — the partner
 * keeps the order even when the cookie jar was emptied in between.
 */

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

function buildService(opts: {
  click?: { linkId: number; clickedAt: Date } | null;
  linkActive?: boolean;
  attributionDays?: number;
}) {
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    linkClickRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue(
          opts.click === undefined
            ? { linkId: 11, clickedAt: daysAgo(10) }
            : opts.click,
        ),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((row) => row),
    },
    linkRepository: {
      findOne: jest.fn().mockResolvedValue(
        opts.linkActive === false
          ? null
          : {
              id: 11,
              partnerId: 8,
              code: 'VANA2026',
              status: PartnerLinkStatusEnum.ACTIVE,
              targetPath: '/esim/japan',
            },
      ),
      increment: jest.fn().mockResolvedValue(undefined),
    },
    partnerRepository: {
      findOne: jest.fn().mockResolvedValue({
        id: 8,
        status: PartnerStatusEnum.ACTIVE,
        partnerType: PartnerTypeEnum.KOL,
        tierCode: 'SILVER',
      }),
    },
    tierRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue({ attributionDays: opts.attributionDays ?? 30 }),
    },
    memberAttributionRepository: {
      save: jest.fn().mockResolvedValue(undefined),
    },
  });

  return service;
}

describe('PartnersService.recordClick — mints the click id (#039)', () => {
  it('should hand back an id the redirect can carry', async () => {
    const service = buildService({});

    const result = await service.recordClick('VANA2026', {});

    expect(result).toMatchObject({ targetPath: '/esim/japan' });
    expect(result!.clickId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should mint a different id for every click', async () => {
    const service = buildService({});

    const first = await service.recordClick('VANA2026', {});
    const second = await service.recordClick('VANA2026', {});

    expect(first!.clickId).not.toBe(second!.clickId);
  });
});

describe('PartnersService.resolveClickForAttribution (#039)', () => {
  it('should credit the partner behind the id', async () => {
    const service = buildService({});

    await expect(
      service.resolveClickForAttribution('a'.repeat(32)),
    ).resolves.toEqual({ partnerId: 8, linkId: 11 });
  });

  it('should read the click date from the log, not from the browser', async () => {
    // 40 days on a 30-day window. Nothing the caller sends can move this: the
    // date is the one the server wrote when it minted the id.
    const service = buildService({
      click: { linkId: 11, clickedAt: daysAgo(40) },
    });

    await expect(
      service.resolveClickForAttribution('a'.repeat(32)),
    ).resolves.toBeNull();
  });

  it('should respect the window the partner’s tier grants', async () => {
    const service = buildService({
      click: { linkId: 11, clickedAt: daysAgo(40) },
      attributionDays: 60,
    });

    await expect(
      service.resolveClickForAttribution('a'.repeat(32)),
    ).resolves.toMatchObject({ partnerId: 8 });
  });

  it('should refuse an id nobody minted', async () => {
    const service = buildService({ click: null });

    await expect(
      service.resolveClickForAttribution('deadbeef'),
    ).resolves.toBeNull();
  });

  it('should refuse a link that has since been switched off', async () => {
    const service = buildService({ linkActive: false });

    await expect(
      service.resolveClickForAttribution('a'.repeat(32)),
    ).resolves.toBeNull();
  });

  it('should have nothing to resolve without an id', async () => {
    const service = buildService({});

    await expect(service.resolveClickForAttribution(null)).resolves.toBeNull();
    await expect(service.resolveClickForAttribution('  ')).resolves.toBeNull();
  });
});

describe('PartnersService.resolveOrderAttribution — the click id outranks the cookie (#039)', () => {
  function withSignals(opts: {
    click?: { partnerId: number; linkId: number } | null;
    link?: { partnerId: number; linkId: number } | null;
    member?: { partnerId: number; linkId: number | null } | null;
  }) {
    const saveMember = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      resolvePartnerForCoupon: jest.fn().mockResolvedValue(null),
      resolveClickForAttribution: jest
        .fn()
        .mockResolvedValue(opts.click ?? null),
      resolveLinkForAttribution: jest.fn().mockResolvedValue(opts.link ?? null),
      resolveMemberAttribution: jest
        .fn()
        .mockResolvedValue(opts.member ?? null),
      memberAttributionRepository: { save: saveMember },
    });
    return { service, saveMember };
  }

  it('should pay the partner from the click id when the cookie is gone', async () => {
    const { service } = withSignals({ click: { partnerId: 8, linkId: 11 } });

    await expect(
      service.resolveOrderAttribution({ clickId: 'a'.repeat(32) }),
    ).resolves.toEqual({
      partnerLinkCode: null,
      attributedPartnerId: 8,
      linkId: 11,
    });
  });

  it('should bind the account from the click id alone', async () => {
    const { service, saveMember } = withSignals({
      click: { partnerId: 8, linkId: 11 },
    });

    await service.resolveOrderAttribution({
      clickId: 'a'.repeat(32),
      buyerUserId: 42,
    });

    expect(saveMember).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, partnerId: 8, linkId: 11 }),
    );
  });

  it('should still let a typed code win over the click id (#033)', async () => {
    const { service } = withSignals({ click: { partnerId: 8, linkId: 11 } });
    Object.assign(service, {
      resolvePartnerForCoupon: jest.fn().mockResolvedValue(3),
    });

    await expect(
      service.resolveOrderAttribution({
        clickId: 'a'.repeat(32),
        couponCode: 'PARTNERC10',
      }),
    ).resolves.toMatchObject({ attributedPartnerId: 3 });
  });

  it('should fall back to the cookie when the id no longer attributes', async () => {
    const { service } = withSignals({
      click: null,
      link: { partnerId: 5, linkId: 7 },
    });

    await expect(
      service.resolveOrderAttribution({
        clickId: 'stale',
        linkCode: 'VANA2026',
        clickedAt: new Date().toISOString(),
      }),
    ).resolves.toMatchObject({ attributedPartnerId: 5 });
  });
});
