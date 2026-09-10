import { PartnersService } from './partners.service';
import {
  PARTNER_LINK_ATTRIBUTION_DAYS,
  PartnerLinkStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
} from './partners.enum';

/**
 * The 30-day attribution window (#095, ý 3).
 *
 * "Đơn hợp lệ" is an order placed within 30 days of the buyer's most recent
 * visit to the marketing link. That window used to be enforced only by the
 * `esim_partner_link` cookie's max-age: the API accepted whatever code the
 * checkout sent, for as long as it kept being sent, and
 * `PARTNER_LINK_ATTRIBUTION_DAYS` sat in `partners.enum.ts` unreferenced.
 *
 * Nothing here may reject an order the rule says is valid — a partner losing a
 * commission they earned is worse than a stale cookie paying one — so the
 * fallback check is deliberately the weakest one that still bounds the window.
 */
describe('PartnersService — 30-day attribution window', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function daysAgo(days: number): Date {
    return new Date(Date.now() - days * DAY_MS);
  }

  function buildService(lastClickAt: Date | null) {
    const linkClickRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue(lastClickAt ? { clickedAt: lastClickAt } : null),
    };

    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      linkRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 12,
          partnerId: 5,
          code: 'VANA2026',
          status: PartnerLinkStatusEnum.ACTIVE,
        }),
      },
      partnerRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 5,
          status: PartnerStatusEnum.ACTIVE,
          partnerType: PartnerTypeEnum.KOL,
        }),
      },
      linkClickRepository,
    });

    return { service, linkClickRepository };
  }

  it('should attribute an order placed within the window', async () => {
    const { service } = buildService(daysAgo(40));

    const resolved = await service.resolveLinkForAttribution(
      'VANA2026',
      daysAgo(29),
    );

    expect(resolved).toEqual({ partnerId: 5, linkId: 12 });
  });

  it('should not attribute an order once the window has passed', async () => {
    const { service } = buildService(daysAgo(1));

    // The cookie outlived its max-age; the visit behind it is 31 days old.
    const resolved = await service.resolveLinkForAttribution(
      'VANA2026',
      daysAgo(PARTNER_LINK_ATTRIBUTION_DAYS + 1),
    );

    expect(resolved).toBeNull();
  });

  it('should count the window from the most recent visit', async () => {
    const { service } = buildService(null);

    // Someone who first clicked months ago but came back yesterday is inside
    // the window — the redirect rewrites the stamp on every visit.
    const resolved = await service.resolveLinkForAttribution(
      'VANA2026',
      daysAgo(1),
    );

    expect(resolved).toEqual({ partnerId: 5, linkId: 12 });
  });

  it('should fall back to the click log when the checkout sends no stamp', async () => {
    const { service, linkClickRepository } = buildService(daysAgo(3));

    const resolved = await service.resolveLinkForAttribution('VANA2026');

    expect(resolved).toEqual({ partnerId: 5, linkId: 12 });
    expect(linkClickRepository.findOne).toHaveBeenCalled();
  });

  it('should refuse a stampless cookie for a link nobody has opened in 30 days', async () => {
    const { service } = buildService(
      daysAgo(PARTNER_LINK_ATTRIBUTION_DAYS + 5),
    );

    // Any real visit leaves a click row, so no honest cookie can be in-window
    // when the link's newest click is older than the window itself.
    const resolved = await service.resolveLinkForAttribution('VANA2026');

    expect(resolved).toBeNull();
  });

  it('should refuse a stampless cookie for a link with no clicks at all', async () => {
    const { service } = buildService(null);

    const resolved = await service.resolveLinkForAttribution('VANA2026');

    expect(resolved).toBeNull();
  });

  it('should not let a future stamp keep a dead link alive', async () => {
    const { service } = buildService(
      daysAgo(PARTNER_LINK_ATTRIBUTION_DAYS + 5),
    );

    // A clock skewed forward would otherwise pass the window check for years.
    const resolved = await service.resolveLinkForAttribution(
      'VANA2026',
      new Date(Date.now() + 90 * DAY_MS),
    );

    expect(resolved).toBeNull();
  });

  it('should still refuse a link that is not an active KOL partner', async () => {
    const { service } = buildService(daysAgo(1));
    Object.assign(service, {
      partnerRepository: { findOne: jest.fn().mockResolvedValue(null) },
    });

    const resolved = await service.resolveLinkForAttribution(
      'VANA2026',
      daysAgo(1),
    );

    expect(resolved).toBeNull();
  });
});
