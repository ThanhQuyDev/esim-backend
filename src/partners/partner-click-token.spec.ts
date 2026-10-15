import { PartnersService } from './partners.service';
import {
  PartnerLinkStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
} from './partners.enum';
import {
  isClickToken,
  signClickToken,
  verifyClickToken,
} from './partner-click-token';

/**
 * Signed click tokens (doitac-1410 #026): the browser holds a token the server
 * signed, with the id of the signing key, and only a genuine token can claim a
 * click handed out that way.
 */
const ID = '0123456789abcdef0123456789abcdef';

describe('partner click token (doitac-1410 #026)', () => {
  it('should round-trip a genuine token and name its key', () => {
    const token = signClickToken(ID);
    expect(token).toMatch(/^v1\.k0\.[0-9a-f]{32}\.[A-Za-z0-9_-]{32}$/);
    expect(isClickToken(token)).toBe(true);
    expect(verifyClickToken(token)).toBe(ID);
  });

  it('should reject a token whose id or signature was changed', () => {
    const token = signClickToken(ID);
    const otherId = token.replace(ID, ID.replace('0', '1'));
    const badSig = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifyClickToken(otherId)).toBeNull();
    expect(verifyClickToken(badSig)).toBeNull();
    expect(verifyClickToken('v1.k9.' + ID + '.x')).toBeNull();
    expect(verifyClickToken(ID)).toBeNull();
  });

  it('should honour a rotated key while it is still listed', () => {
    const before = { ...process.env };
    process.env.PARTNER_CLICK_KEYS =
      'k1:aaaaaaaaaaaaaaaaaaaa,k2:bbbbbbbbbbbbbbbbbbbb';
    process.env.PARTNER_CLICK_KEY_ID = 'k1';
    const old = signClickToken(ID);
    process.env.PARTNER_CLICK_KEY_ID = 'k2';
    expect(signClickToken(ID)).toMatch(/^v1\.k2\./);
    expect(verifyClickToken(old)).toBe(ID);
    process.env = before;
  });
});

describe('PartnersService — claiming a click (doitac-1410 #026)', () => {
  function build(click: Record<string, unknown> | null) {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      linkClickRepository: { findOne: jest.fn().mockResolvedValue(click) },
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
        }),
      },
      attributionDaysFor: jest.fn().mockResolvedValue(30),
    });
    return service;
  }
  const fresh = { linkId: 11, clickId: ID, clickedAt: new Date() };

  it('should credit a signed click claimed with its token', async () => {
    const service = build({ ...fresh, signed: true });
    await expect(
      service.resolveClickForAttribution(signClickToken(ID)),
    ).resolves.toEqual({ partnerId: 8, linkId: 11 });
  });

  it('should refuse the bare id of a signed click', async () => {
    const service = build({ ...fresh, signed: true });
    await expect(service.resolveClickForAttribution(ID)).resolves.toBeNull();
  });

  it('should still honour the bare id of a click from before tokens', async () => {
    const service = build({ ...fresh, signed: false });
    await expect(service.resolveClickForAttribution(ID)).resolves.toEqual({
      partnerId: 8,
      linkId: 11,
    });
  });

  it('should refuse a forged token without touching the click log', async () => {
    const service = build({ ...fresh, signed: true });
    await expect(
      service.resolveClickForAttribution(
        `v1.k0.${ID}.forgedforgedforgedforgedforged12`,
      ),
    ).resolves.toBeNull();
    expect(
      (service as unknown as { linkClickRepository: { findOne: jest.Mock } })
        .linkClickRepository.findOne,
    ).not.toHaveBeenCalled();
  });
});
