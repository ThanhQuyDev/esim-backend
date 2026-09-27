import { PartnersService } from './partners.service';

/**
 * Who earns on an order, when several signals disagree (#033, #034, #035).
 *
 * The case that drives it: a customer browses on a laptop and buys on a phone.
 * With no code and no account tying the two together there is nothing to go on,
 * and paying a partner anyway would be paying them for somebody else's
 * customer.
 */

function buildService(opts: {
  couponPartnerId?: number | null;
  link?: { partnerId: number; linkId: number } | null;
  member?: { partnerId: number; linkId: number | null } | null;
}) {
  const bindLinkToMember = jest.fn().mockResolvedValue(null);
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    resolvePartnerForCoupon: jest
      .fn()
      .mockResolvedValue(opts.couponPartnerId ?? null),
    resolveLinkForAttribution: jest.fn().mockResolvedValue(opts.link ?? null),
    resolveMemberAttribution: jest.fn().mockResolvedValue(opts.member ?? null),
    bindLinkToMember,
  });

  return { service, bindLinkToMember };
}

describe('PartnersService — which signal wins (#033, #034, #035)', () => {
  it('should give the order to the code that was typed, over the link that was clicked', async () => {
    const { service } = buildService({
      couponPartnerId: 8,
      link: { partnerId: 3, linkId: 11 },
    });

    await expect(
      service.resolveOrderAttribution({
        linkCode: 'PARTNER-A',
        clickedAt: new Date().toISOString(),
        couponCode: 'PARTNERB10',
        buyerUserId: 42,
      }),
    ).resolves.toEqual({
      partnerLinkCode: null,
      attributedPartnerId: 8,
      linkId: null,
    });
  });

  it('should earn nobody anything when only another device saw the link (#035)', async () => {
    // Anonymous click on a laptop, purchase on a phone: no cookie here, no
    // code, and the account carries nothing.
    const { service } = buildService({ member: null });

    await expect(
      service.resolveOrderAttribution({ buyerUserId: 42 }),
    ).resolves.toEqual({
      partnerLinkCode: null,
      attributedPartnerId: null,
      linkId: null,
    });
  });

  it('should still pay the partner when the customer types their code on the phone (#035)', async () => {
    const { service } = buildService({ couponPartnerId: 8 });

    await expect(
      service.resolveOrderAttribution({
        couponCode: 'VANA2026',
        buyerUserId: 42,
      }),
    ).resolves.toMatchObject({ attributedPartnerId: 8 });
  });

  it('should fall back to what the account remembers (#034)', async () => {
    const { service } = buildService({
      member: { partnerId: 5, linkId: 7 },
    });

    await expect(
      service.resolveOrderAttribution({ buyerUserId: 42 }),
    ).resolves.toEqual({
      partnerLinkCode: null,
      attributedPartnerId: 5,
      linkId: 7,
    });
  });

  it('should fall back to the account when the cookie code no longer attributes', async () => {
    // An expired or switched-off link must not shadow a valid binding.
    const { service } = buildService({
      link: null,
      member: { partnerId: 5, linkId: 7 },
    });

    await expect(
      service.resolveOrderAttribution({
        linkCode: 'EXPIRED',
        buyerUserId: 42,
      }),
    ).resolves.toMatchObject({ attributedPartnerId: 5 });
  });

  it('should bind the link to the account when a signed-in customer buys through it', async () => {
    const { service, bindLinkToMember } = buildService({
      link: { partnerId: 3, linkId: 11 },
    });

    await service.resolveOrderAttribution({
      linkCode: 'VANA2026',
      clickedAt: new Date().toISOString(),
      buyerUserId: 42,
    });

    expect(bindLinkToMember).toHaveBeenCalledWith(42, 'VANA2026');
  });

  it('should not bind anything for a guest checkout', async () => {
    const { service, bindLinkToMember } = buildService({
      link: { partnerId: 3, linkId: 11 },
    });

    await service.resolveOrderAttribution({
      linkCode: 'VANA2026',
      clickedAt: new Date().toISOString(),
      buyerUserId: null,
    });

    expect(bindLinkToMember).not.toHaveBeenCalled();
  });
});
