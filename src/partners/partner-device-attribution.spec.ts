import { PartnersService } from './partners.service';
import { partnerDeviceFingerprint } from './partner-device-fingerprint';
import {
  PartnerLinkStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
} from './partners.enum';

/**
 * The server-side device fingerprint (#039).
 *
 * The click id in the URL is the mechanism; this is what is left when even the
 * URL did not survive — an in-app browser that strips the query string, on an
 * iOS device that dropped the cookie days ago. Last of all the signals, so an
 * explicit code, a live cookie or a bound account always outranks it.
 */

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

describe('partnerDeviceFingerprint (#039)', () => {
  it('should be stable for the same device and differ for another', () => {
    const first = partnerDeviceFingerprint('a'.repeat(64), UA);

    expect(first).toBe(partnerDeviceFingerprint(`${'a'.repeat(64)} `, UA));
    expect(first).not.toBe(partnerDeviceFingerprint('b'.repeat(64), UA));
    expect(first).not.toBe(
      partnerDeviceFingerprint('a'.repeat(64), `${UA} Safari`),
    );
  });

  it('should match across the two address-hash lengths the sides send', () => {
    // `/go` forwards the full sha256, the order stores its first 32 characters.
    const full = 'a'.repeat(64);

    expect(partnerDeviceFingerprint(full, UA)).toBe(
      partnerDeviceFingerprint(full.slice(0, 32), UA),
    );
  });

  it('should refuse to fingerprint half a device', () => {
    expect(partnerDeviceFingerprint('a'.repeat(64), null)).toBeNull();
    expect(partnerDeviceFingerprint(null, UA)).toBeNull();
    expect(partnerDeviceFingerprint('  ', UA)).toBeNull();
  });
});

function buildService(opts: {
  click?: { linkId: number; clickedAt: Date } | null;
  partnerType?: PartnerTypeEnum;
}) {
  const findClick = jest
    .fn()
    .mockResolvedValue(
      opts.click === undefined
        ? { linkId: 11, clickedAt: daysAgo(3) }
        : opts.click,
    );
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    linkClickRepository: { findOne: findClick },
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
        partnerType: opts.partnerType ?? PartnerTypeEnum.KOL,
        tierCode: 'SILVER',
      }),
    },
    tierRepository: {
      findOne: jest.fn().mockResolvedValue({ attributionDays: 30 }),
    },
  });

  return { service, findClick };
}

describe('PartnersService.resolveDeviceForAttribution (#039)', () => {
  it('should credit the partner whose link this device opened', async () => {
    const { service, findClick } = buildService({});

    await expect(
      service.resolveDeviceForAttribution('a'.repeat(64), UA),
    ).resolves.toEqual({ partnerId: 8, linkId: 11 });
    // Newest click for the device, not just any of them.
    expect(findClick).toHaveBeenCalledWith(
      expect.objectContaining({ order: { clickedAt: 'DESC' } }),
    );
  });

  it('should refuse a click older than the window', async () => {
    const { service } = buildService({
      click: { linkId: 11, clickedAt: daysAgo(40) },
    });

    await expect(
      service.resolveDeviceForAttribution('a'.repeat(64), UA),
    ).resolves.toBeNull();
  });

  it('should have nothing to match when a signal is missing', async () => {
    const { service, findClick } = buildService({});

    await expect(
      service.resolveDeviceForAttribution('a'.repeat(64), null),
    ).resolves.toBeNull();
    expect(findClick).not.toHaveBeenCalled();
  });

  it('should not pay a distribution partner an affiliate commission', async () => {
    const { service } = buildService({
      partnerType: PartnerTypeEnum.DISTRIBUTION,
    });

    await expect(
      service.resolveDeviceForAttribution('a'.repeat(64), UA),
    ).resolves.toBeNull();
  });
});

describe('PartnersService.resolveOrderAttribution — the device comes last (#039)', () => {
  function withSignals(opts: {
    member?: { partnerId: number; linkId: number | null } | null;
    device?: { partnerId: number; linkId: number } | null;
  }) {
    const resolveDevice = jest.fn().mockResolvedValue(opts.device ?? null);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      resolvePartnerForCoupon: jest.fn().mockResolvedValue(null),
      resolveClickForAttribution: jest.fn().mockResolvedValue(null),
      resolveLinkForAttribution: jest.fn().mockResolvedValue(null),
      resolveMemberAttribution: jest
        .fn()
        .mockResolvedValue(opts.member ?? null),
      resolveDeviceForAttribution: resolveDevice,
    });
    return { service, resolveDevice };
  }

  it('should save the attribution when nothing else survived the trip', async () => {
    const { service } = withSignals({ device: { partnerId: 8, linkId: 11 } });

    await expect(
      service.resolveOrderAttribution({
        ipHash: 'a'.repeat(64),
        userAgent: UA,
      }),
    ).resolves.toEqual({
      partnerLinkCode: null,
      attributedPartnerId: 8,
      linkId: 11,
    });
  });

  it('should not look at the device when the account already answers', async () => {
    const { service, resolveDevice } = withSignals({
      member: { partnerId: 5, linkId: 7 },
      device: { partnerId: 8, linkId: 11 },
    });

    await expect(
      service.resolveOrderAttribution({
        buyerUserId: 42,
        ipHash: 'a'.repeat(64),
        userAgent: UA,
      }),
    ).resolves.toMatchObject({ attributedPartnerId: 5 });
    expect(resolveDevice).not.toHaveBeenCalled();
  });

  it('should earn nobody anything when the device has no click either', async () => {
    const { service } = withSignals({ device: null });

    await expect(
      service.resolveOrderAttribution({
        ipHash: 'a'.repeat(64),
        userAgent: UA,
      }),
    ).resolves.toMatchObject({ attributedPartnerId: null });
  });
});
