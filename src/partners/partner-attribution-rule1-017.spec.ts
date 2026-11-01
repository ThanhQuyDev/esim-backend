import { PartnersService } from './partners.service';
import { signClickToken } from './partner-click-token';
import {
  PartnerLinkStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
} from './partners.enum';

/**
 * doitac-3010 #017, rule 1 — when an order comes in the server computes the
 * HMAC again, looks the click id up in its click table and takes the link and
 * partner from that record. An edited or forged cookie earns nothing, and
 * every refusal leaves a reason behind.
 */

const CLICK_ID = 'a'.repeat(32);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

function buildService(
  opts: {
    click?: { linkId: number; clickedAt: Date; signed?: boolean } | null;
    linkActive?: boolean;
    deviceClicked?: boolean;
  } = {},
) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const query = jest.fn().mockResolvedValue([]);
  const link = {
    id: 11,
    partnerId: 8,
    code: 'REALCODE',
    status: PartnerLinkStatusEnum.ACTIVE,
  };
  Object.assign(service, {
    dataSource: { query },
    logger: { warn: jest.fn(), error: jest.fn() },
    linkClickRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue(
          opts.click === undefined
            ? { linkId: 11, clickedAt: daysAgo(2), signed: true }
            : opts.click,
        ),
    },
    linkRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue(opts.linkActive === false ? null : link),
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
      findOne: jest.fn().mockResolvedValue({ attributionDays: 30 }),
    },
    memberAttributionRepository: {
      save: jest.fn().mockResolvedValue(undefined),
    },
  });
  for (const [name, value] of [
    ['resolvePartnerForCoupon', null],
    ['resolveMemberAttribution', null],
    ['resolveDeviceForAttribution', null],
    ['linkClickedFromDevice', Boolean(opts.deviceClicked)],
  ] as const) {
    jest
      .spyOn(service as never, name as never)
      .mockResolvedValue(value as never);
  }
  return { service, query };
}

const reasons = (query: jest.Mock) =>
  query.mock.calls
    .filter(([sql]) => String(sql).includes('partner_attribution_rejection'))
    .map(([, params]) => (params as unknown[])[0]);

describe('Rule 1 — the server checks the click on every order (doitac-3010 #017)', () => {
  it('should credit a genuine token, with the link code from the server record', async () => {
    const { service, query } = buildService();
    const result = await service.resolveOrderAttribution({
      clickId: signClickToken(CLICK_ID),
      // Whatever the browser claims, the click was on REALCODE.
      linkCode: 'SOMEONEELSE',
    });
    expect(result).toMatchObject({
      partnerLinkCode: 'REALCODE',
      attributedPartnerId: 8,
      linkId: 11,
    });
    expect(reasons(query)).toEqual([]);
  });

  it('should refuse a token whose signature was edited, and log why', async () => {
    const { service, query } = buildService();
    const token = signClickToken(CLICK_ID);
    const edited = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    const result = await service.resolveOrderAttribution({ clickId: edited });
    expect(result.attributedPartnerId).toBeNull();
    expect(reasons(query)).toEqual(['forged_signature']);
  });

  it('should refuse a token for a click id swapped in by hand', async () => {
    const { service, query } = buildService();
    const [v, key, , sig] = signClickToken(CLICK_ID).split('.');
    const forged = [v, key, 'b'.repeat(32), sig].join('.');
    const result = await service.resolveOrderAttribution({ clickId: forged });
    expect(result.attributedPartnerId).toBeNull();
    expect(reasons(query)).toEqual(['forged_signature']);
  });

  it('should refuse a token signed with a key the server does not hold', async () => {
    const { service, query } = buildService();
    const result = await service.resolveOrderAttribution({
      clickId: `v1.k9.${CLICK_ID}.${'x'.repeat(32)}`,
    });
    expect(result.attributedPartnerId).toBeNull();
    expect(reasons(query)).toEqual(['forged_signature']);
  });

  it('should refuse a well-signed id that is not in the click table', async () => {
    const { service, query } = buildService({ click: null });
    const result = await service.resolveOrderAttribution({
      clickId: signClickToken(CLICK_ID),
    });
    expect(result.attributedPartnerId).toBeNull();
    expect(reasons(query)).toEqual(['unknown_click']);
  });

  it('should refuse the bare id of a signed click', async () => {
    const { service, query } = buildService();
    const result = await service.resolveOrderAttribution({ clickId: CLICK_ID });
    expect(result.attributedPartnerId).toBeNull();
    expect(reasons(query)).toEqual(['unsigned_claim']);
  });

  it('should refuse a click past the attribution window, read from the server log', async () => {
    const { service, query } = buildService({
      click: { linkId: 11, clickedAt: daysAgo(45), signed: true },
    });
    const result = await service.resolveOrderAttribution({
      clickId: signClickToken(CLICK_ID),
    });
    expect(result.attributedPartnerId).toBeNull();
    expect(reasons(query)).toEqual(['window_expired']);
  });

  it('should refuse a click on a link that was switched off', async () => {
    const { service, query } = buildService({ linkActive: false });
    const result = await service.resolveOrderAttribution({
      clickId: signClickToken(CLICK_ID),
    });
    expect(result.attributedPartnerId).toBeNull();
    expect(reasons(query)).toEqual(['link_inactive']);
  });

  it('should refuse a hand-written code cookie when this device never clicked', async () => {
    const { service, query } = buildService({ deviceClicked: false });
    const result = await service.resolveOrderAttribution({
      linkCode: 'REALCODE',
      clickedAt: new Date().toISOString(),
      ipHash: 'ip',
      userAgent: 'ua',
    });
    expect(result.attributedPartnerId).toBeNull();
    expect(reasons(query)).toEqual(['no_click_from_device']);
  });

  it('should log nothing for an order that came with no click at all', async () => {
    const { service, query } = buildService();
    const result = await service.resolveOrderAttribution({});
    expect(result.attributedPartnerId).toBeNull();
    expect(reasons(query)).toEqual([]);
  });

  it('should still place the order when the log cannot be written', async () => {
    const { service, query } = buildService();
    query.mockRejectedValue(new Error('db down'));
    const result = await service.resolveOrderAttribution({
      clickId: `v1.k0.${CLICK_ID}.${'x'.repeat(32)}`,
    });
    expect(result.attributedPartnerId).toBeNull();
  });
});
