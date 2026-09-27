import { PartnersService } from './partners.service';
import {
  PartnerLinkStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
} from './partners.enum';

/**
 * How long a click keeps earning the partner the order (#037, #072).
 *
 * The window used to be one number for the whole programme. It belongs to the
 * partner's tier — Silver is credited for 15 days, a higher tier for longer —
 * and every fresh click restarts that partner's own clock.
 */

function buildService(opts: {
  attributionDays?: number | null;
  tierCode?: string | null;
}) {
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    linkRepository: {
      findOne: jest.fn().mockResolvedValue({
        id: 11,
        partnerId: 8,
        status: PartnerLinkStatusEnum.ACTIVE,
      }),
    },
    partnerRepository: {
      findOne: jest.fn().mockResolvedValue({
        id: 8,
        status: PartnerStatusEnum.ACTIVE,
        partnerType: PartnerTypeEnum.KOL,
        tierCode: opts.tierCode === undefined ? 'SILVER' : opts.tierCode,
      }),
    },
    tierRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue(
          opts.attributionDays === null
            ? null
            : { attributionDays: opts.attributionDays ?? 15 },
        ),
    },
    linkClickRepository: { findOne: jest.fn().mockResolvedValue(null) },
  });

  return service;
}

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe('PartnersService — the attribution window comes from the tier (#037)', () => {
  it('should credit a click inside the tier’s own window', async () => {
    const service = buildService({ attributionDays: 15 });

    await expect(
      service.resolveLinkForAttribution('VANA2026', daysAgo(10)),
    ).resolves.toEqual({ partnerId: 8, linkId: 11 });
  });

  it('should refuse a click older than the tier allows', async () => {
    // 20 days on a 15-day tier: inside the old fixed 30-day window, outside
    // the one this partner actually has.
    const service = buildService({ attributionDays: 15 });

    await expect(
      service.resolveLinkForAttribution('VANA2026', daysAgo(20)),
    ).resolves.toBeNull();
  });

  it('should give a higher tier the longer window it was granted', async () => {
    const service = buildService({ attributionDays: 60 });

    await expect(
      service.resolveLinkForAttribution('VANA2026', daysAgo(45)),
    ).resolves.toMatchObject({ partnerId: 8 });
  });

  it('should fall back to the programme default for a partner with no tier', async () => {
    const service = buildService({ tierCode: null });

    await expect(
      service.resolveLinkForAttribution('VANA2026', daysAgo(20)),
    ).resolves.toMatchObject({ partnerId: 8 });
    await expect(
      service.resolveLinkForAttribution('VANA2026', daysAgo(40)),
    ).resolves.toBeNull();
  });

  it('should treat a fresh click as restarting the clock', async () => {
    const service = buildService({ attributionDays: 15 });

    // The same link that was refused at 20 days is credited again once the
    // customer opens it today.
    await expect(
      service.resolveLinkForAttribution('VANA2026', daysAgo(20)),
    ).resolves.toBeNull();
    await expect(
      service.resolveLinkForAttribution('VANA2026', new Date()),
    ).resolves.toMatchObject({ partnerId: 8 });
  });
});
