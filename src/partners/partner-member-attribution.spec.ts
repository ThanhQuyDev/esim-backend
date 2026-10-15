import { PartnersService } from './partners.service';
import { PartnerStatusEnum, PartnerTypeEnum } from './partners.enum';
import { signClickToken } from './partner-click-token';

/**
 * Attribution that follows the account, not the browser (#034).
 *
 * Somebody opens a KOL's link on their laptop while signed in, then buys on
 * their phone where no cookie exists. It is the same customer, and the brief
 * says the partner still earns.
 */

function buildService(opts: {
  row?: Record<string, unknown> | null;
  partner?: Record<string, unknown> | null;
}) {
  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    memberAttributionRepository: {
      findOne: jest.fn().mockResolvedValue(opts.row ?? null),
      save,
    },
    partnerRepository: {
      findOne: jest.fn().mockResolvedValue(
        opts.partner === undefined
          ? {
              id: 8,
              status: PartnerStatusEnum.ACTIVE,
              partnerType: PartnerTypeEnum.KOL,
            }
          : opts.partner,
      ),
    },
  });

  return { service, save };
}

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe('PartnersService — attribution bound to the account (#034)', () => {
  it('should credit the partner a signed-in customer arrived through', async () => {
    const { service } = buildService({
      row: { userId: 42, partnerId: 8, linkId: 11, attributedAt: daysAgo(3) },
    });

    await expect(service.resolveMemberAttribution(42)).resolves.toEqual({
      partnerId: 8,
      linkId: 11,
    });
  });

  it('should let the binding expire with the attribution window', async () => {
    const { service } = buildService({
      row: { userId: 42, partnerId: 8, linkId: 11, attributedAt: daysAgo(90) },
    });

    await expect(service.resolveMemberAttribution(42)).resolves.toBeNull();
  });

  it('should ignore a partner who has since been suspended', async () => {
    const { service } = buildService({
      row: { userId: 42, partnerId: 8, linkId: 11, attributedAt: daysAgo(1) },
      partner: null,
    });

    await expect(service.resolveMemberAttribution(42)).resolves.toBeNull();
  });

  it('should have nothing to say about a guest', async () => {
    const { service } = buildService({ row: null });

    await expect(service.resolveMemberAttribution(null)).resolves.toBeNull();
  });

  it('should store the newest link when one is bound', async () => {
    const { service, save } = buildService({ row: null });
    Object.assign(service, {
      resolveClickForAttribution: jest
        .fn()
        .mockResolvedValue({ partnerId: 8, linkId: 11 }),
      linkRepository: {
        findOne: jest.fn().mockResolvedValue({ id: 11, code: 'VANA2026' }),
      },
    });

    await service.bindLinkToMember(
      42,
      'VANA2026',
      signClickToken('cd'.repeat(16)),
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, partnerId: 8, linkId: 11 }),
    );
  });

  it('should refuse to bind on the link code alone (doitac-1410 #026)', async () => {
    // The code is printed on every post: typing it must not pin a partner to
    // somebody's account. Only the visitor's own signed click may.
    const { service, save } = buildService({ row: null });
    Object.assign(service, {
      resolveLinkForAttribution: jest
        .fn()
        .mockResolvedValue({ partnerId: 8, linkId: 11 }),
    });

    await expect(service.bindLinkToMember(42, 'VANA2026')).resolves.toBeNull();
    await expect(
      service.bindLinkToMember(42, 'VANA2026', 'cd'.repeat(16)),
    ).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('should refuse a token for a different link', async () => {
    const { service, save } = buildService({ row: null });
    Object.assign(service, {
      resolveClickForAttribution: jest
        .fn()
        .mockResolvedValue({ partnerId: 8, linkId: 11 }),
      linkRepository: {
        findOne: jest.fn().mockResolvedValue({ id: 11, code: 'OTHER' }),
      },
    });

    await expect(
      service.bindLinkToMember(42, 'VANA2026', signClickToken('cd'.repeat(16))),
    ).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('should store nothing for a code that no longer attributes', async () => {
    const { service, save } = buildService({ row: null });
    Object.assign(service, {
      resolveLinkForAttribution: jest.fn().mockResolvedValue(null),
    });

    await expect(service.bindLinkToMember(42, 'GONE')).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
