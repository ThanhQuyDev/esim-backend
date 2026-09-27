import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';
import {
  PARTNER_LINK_CODE_MAX_LENGTH,
  PARTNER_LINK_CODE_MIN_LENGTH,
} from './dto/partner-link.dto';

/**
 * Naming your own marketing link (#014).
 *
 * `/go/TENTUY` is worth having precisely because it is short and memorable,
 * which is why it cannot be open to everyone — the good names would be gone in
 * a week. An admin ticks the partners who may choose one; everybody else gets a
 * generated code, and says so rather than silently receiving a random string.
 */

function buildService(opts: {
  canCustomLinkCode: boolean;
  takenCode?: string;
}) {
  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    partnerRepository: {
      findOne: jest.fn().mockResolvedValue({
        id: 5,
        partnerType: PartnerTypeEnum.KOL,
        canCustomLinkCode: opts.canCustomLinkCode,
      }),
      save,
    },
    linkRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue(opts.takenCode ? { code: opts.takenCode } : null),
      create: (row: unknown) => row,
      save,
    },
  });

  return { service, save };
}

describe('PartnersService — naming your own link code (#014)', () => {
  it('should refuse a chosen code from a partner who was not granted it', async () => {
    const { service, save } = buildService({ canCustomLinkCode: false });

    await expect(
      service.createLink(5, { label: 'TikTok', code: 'VANA2026' }),
    ).rejects.toThrow('chưa được cấp quyền đặt tên link tiếp thị');

    expect(save).not.toHaveBeenCalled();
  });

  it('should keep the code when the partner was granted it', async () => {
    const { service, save } = buildService({ canCustomLinkCode: true });

    await service.createLink(5, { label: 'TikTok', code: 'VanA2026' });

    // Normalised to one case: /go/vana2026 and /go/VANA2026 are the same link
    // to anyone typing it off a video.
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VANA2026', partnerId: 5 }),
    );
  });

  it('should still refuse a code somebody else holds', async () => {
    const { service } = buildService({
      canCustomLinkCode: true,
      takenCode: 'VANA2026',
    });

    await expect(
      service.createLink(5, { label: 'TikTok', code: 'VANA2026' }),
    ).rejects.toMatchObject({
      response: { errors: { code: expect.any(String) } },
    });
  });

  it('should generate a code for a partner who names none', async () => {
    const { service, save } = buildService({ canCustomLinkCode: false });

    await service.createLink(5, { label: 'TikTok' });

    const created = save.mock.calls[0][0] as { code: string };
    expect(created.code).toMatch(/^[A-Z0-9]+$/);
  });

  it('should hold the brief’s bounds for a chosen code', () => {
    expect(PARTNER_LINK_CODE_MIN_LENGTH).toBe(8);
    expect(PARTNER_LINK_CODE_MAX_LENGTH).toBe(50);
  });
});
