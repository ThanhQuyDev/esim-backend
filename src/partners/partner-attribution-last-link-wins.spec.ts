import { PartnersService } from './partners.service';
import { signClickToken } from './partner-click-token';

/** The visitor's own signed click, required to bind (doitac-1410 #026). */
const TOKEN = signClickToken('ab'.repeat(16));

/**
 * The later link replaces the earlier one (#038).
 *
 * The case from the brief: a customer opens partner A's link, browses, signs
 * in, and later opens partner B's link. The order belongs to B — the customer
 * arrived through B, and paying A for a visit B produced would be paying the
 * wrong person.
 */

function buildService(opts: {
  link?: { partnerId: number; linkId: number } | null;
  member?: { partnerId: number; linkId: number | null } | null;
}) {
  const save = jest.fn().mockResolvedValue(undefined);
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    resolvePartnerForCoupon: jest.fn().mockResolvedValue(null),
    resolveLinkForAttribution: jest.fn().mockResolvedValue(opts.link ?? null),
    resolveMemberAttribution: jest.fn().mockResolvedValue(opts.member ?? null),
    memberAttributionRepository: { save },
    // The cookie's code counts only when this device clicked it (#026).
    linkClickedFromDevice: jest.fn().mockResolvedValue(true),
    partnerRepository: { findOne: jest.fn().mockResolvedValue({ id: 2 }) },
    attributionDaysFor: jest.fn().mockResolvedValue(30),
    resolveClickForAttribution: jest.fn((token?: string | null) =>
      Promise.resolve(token ? (opts.link ?? null) : null),
    ),
    linkRepository: {
      findOne: jest.fn().mockResolvedValue({ code: 'PARTNER-B' }),
    },
  });

  return { service, save };
}

describe('PartnersService — the later link wins (#038)', () => {
  it('should give the order to the link the customer opened last', async () => {
    // Account still remembers A; the cookie carries B's code.
    const { service } = buildService({
      link: { partnerId: 2, linkId: 22 },
      member: { partnerId: 1, linkId: 11 },
    });

    await expect(
      service.resolveOrderAttribution({
        linkCode: 'PARTNER-B',
        clickedAt: new Date().toISOString(),
        buyerUserId: 42,
      }),
    ).resolves.toEqual({
      partnerLinkCode: 'PARTNER-B',
      attributedPartnerId: 2,
      linkId: 22,
    });
  });

  it('should move the account binding to the newer partner', async () => {
    const { service, save } = buildService({
      link: { partnerId: 2, linkId: 22 },
    });

    await service.bindLinkToMember(42, 'PARTNER-B', TOKEN);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, partnerId: 2, linkId: 22 }),
    );
  });

  it('should push the window forward when the same link is opened again', async () => {
    // One row per account, so re-binding rewrites attributedAt — that is what
    // restarts the tier's window on a fresh click (#037).
    const { service, save } = buildService({
      link: { partnerId: 2, linkId: 22 },
    });
    const before = Date.now();

    await service.bindLinkToMember(42, 'PARTNER-B', TOKEN);

    const saved = save.mock.calls[0][0] as { attributedAt: Date };
    expect(saved.attributedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('should leave the binding alone when the newer link cannot attribute', async () => {
    // B's link was switched off between the click and the order: nothing to
    // overwrite A with, and the account keeps what it had.
    const { service, save } = buildService({
      link: null,
      member: { partnerId: 1, linkId: 11 },
    });

    await expect(
      service.resolveOrderAttribution({
        linkCode: 'PARTNER-B',
        buyerUserId: 42,
      }),
    ).resolves.toMatchObject({ attributedPartnerId: 1 });
    expect(save).not.toHaveBeenCalled();
  });
});
