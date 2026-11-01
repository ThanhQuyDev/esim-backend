import { PartnersService } from './partners.service';

/**
 * doitac-3010 #022, rule 6 — which signal wins, and every one weighed is kept:
 * - a code published for everyone ("mã chung") never overrides the link;
 * - a partner's own code does not override a content link clicked in the
 *   last 30 minutes, but still beats an older one (#033);
 * - each order can be traced to the clicks and codes that were looked at.
 */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

function buildService(opts: {
  coupon?: { partnerId: number; isPublic: boolean } | null;
  click?: { partnerId: number; linkId: number; clickedAt: Date } | null;
  deviceClicks?: object[];
}) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    resolvePartnerForCoupon: jest
      .fn()
      .mockResolvedValue(opts.coupon?.partnerId ?? null),
    couponRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue(
          opts.coupon ? { isPublic: opts.coupon.isPublic } : null,
        ),
    },
    checkClickForAttribution: jest.fn().mockResolvedValue(
      opts.click
        ? {
            ok: true,
            ...opts.click,
            linkCode: 'CONTENT1',
            clickId: 'c'.repeat(32),
            confirmed: true,
            botScore: 0,
          }
        : { ok: false, reason: null },
    ),
    resolveMemberAttribution: jest.fn().mockResolvedValue(null),
    resolveDeviceForAttribution: jest.fn().mockResolvedValue(null),
    saveMemberAttribution: jest.fn().mockResolvedValue(undefined),
    linkClickRepository: {
      find: jest.fn().mockResolvedValue(opts.deviceClicks ?? []),
    },
    linkRepository: {
      find: jest
        .fn()
        .mockResolvedValue([{ id: 31, partnerId: 9, code: 'OTHERLINK' }]),
    },
  });
  return service;
}

const ORDER = {
  clickId: 'v1.k0.token',
  couponCode: 'PARTNERB',
  buyerUserId: 4,
  ipHash: 'net',
  userAgent: 'Mozilla/5.0',
};

describe('Rule 6 — which click wins (doitac-3010 #022)', () => {
  it('should not let a public code take the order from the link', async () => {
    const service = buildService({
      coupon: { partnerId: 2, isPublic: true },
      click: { partnerId: 1, linkId: 11, clickedAt: minutesAgo(600) },
    });
    const result = await service.resolveOrderAttribution(ORDER);
    expect(result).toMatchObject({ attributedPartnerId: 1, linkId: 11 });
    expect(result.trace?.rule).toBe('public_code_no_override');
  });

  it('should not let a private code override a content link clicked minutes ago', async () => {
    const service = buildService({
      coupon: { partnerId: 2, isPublic: false },
      click: { partnerId: 1, linkId: 11, clickedAt: minutesAgo(10) },
    });
    const result = await service.resolveOrderAttribution(ORDER);
    expect(result).toMatchObject({
      attributedPartnerId: 1,
      linkId: 11,
      partnerLinkCode: 'CONTENT1',
    });
    expect(result.trace?.rule).toBe('recent_link_beats_coupon');
  });

  it('should still give the order to a private code over an older link (#033)', async () => {
    const service = buildService({
      coupon: { partnerId: 2, isPublic: false },
      click: { partnerId: 1, linkId: 11, clickedAt: minutesAgo(45) },
    });
    const result = await service.resolveOrderAttribution(ORDER);
    expect(result).toMatchObject({ attributedPartnerId: 2, linkId: null });
    expect(result.trace?.rule).toBe('coupon_beats_link');
    // The link is kept in the trace, marked as the one that lost.
    expect(result.trace?.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'coupon', outcome: 'won' }),
        expect.objectContaining({ source: 'click', outcome: 'lost' }),
      ]),
    );
  });

  it('should give a public code its partner when there is no link at all', async () => {
    const service = buildService({ coupon: { partnerId: 2, isPublic: true } });
    const result = await service.resolveOrderAttribution(ORDER);
    expect(result).toMatchObject({ attributedPartnerId: 2 });
    expect(result.trace?.rule).toBe('coupon_only');
  });

  it("should list this device's other confirmed clicks as considered", async () => {
    const service = buildService({
      click: { partnerId: 1, linkId: 11, clickedAt: minutesAgo(5) },
      deviceClicks: [
        // The winning click itself is not listed twice.
        { clickId: 'c'.repeat(32), linkId: 11, clickedAt: minutesAgo(5) },
        {
          clickId: 'e'.repeat(32),
          linkId: 31,
          clickedAt: minutesAgo(90),
          botScore: 0,
        },
      ],
    });
    const result = await service.resolveOrderAttribution(ORDER);
    expect(result.trace?.rule).toBe('link_click');
    expect(result.trace?.candidates).toEqual([
      expect.objectContaining({
        source: 'click',
        outcome: 'won',
        code: 'CONTENT1',
      }),
      expect.objectContaining({
        source: 'device_click',
        outcome: 'considered',
        code: 'OTHERLINK',
        partnerId: 9,
      }),
    ]);
  });

  it('should keep the trace with the order', async () => {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const query = jest.fn().mockResolvedValue([]);
    Object.assign(service, { dataSource: { query } });
    await service.saveAttributionTrace(77, {
      rule: 'link_click',
      candidates: [],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('order_attribution_trace'),
      [77, 'link_click', '[]'],
    );
  });
});
