import { PartnersService, classifyPartnerOrder } from './partners.service';
import { PartnerStatusEnum, PartnerTypeEnum } from './partners.enum';

/**
 * What a partner can do for themselves (#095, ý c).
 *
 * Two gaps this covers. Codes were always machine-generated, so a KOL could
 * not have the memorable code they read out in a video — the brief asks for
 * "link/mã giới thiệu tối thiểu 6 ký tự tùy ý". And the partner's own order
 * list showed every attributed order alike, so a cancelled order looked
 * exactly like one that paid.
 */
describe('PartnersService — partner self-service', () => {
  describe('picking your own referral code', () => {
    function buildService(existingCode: string | null) {
      const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
      const linkRepository = {
        findOne: jest
          .fn()
          .mockResolvedValue(existingCode ? { code: existingCode } : null),
        create: jest.fn().mockImplementation((row) => row),
        save,
      };

      const service = Object.create(
        PartnersService.prototype,
      ) as PartnersService;
      Object.assign(service, {
        partnerRepository: {
          findOne: jest.fn().mockResolvedValue({
            id: 5,
            status: PartnerStatusEnum.ACTIVE,
            partnerType: PartnerTypeEnum.KOL,
          }),
        },
        linkRepository,
      });

      return { service, linkRepository, save };
    }

    it('should keep the code the partner asked for', async () => {
      const { service, save } = buildService(null);

      await service.createLink(5, { label: 'TikTok', code: 'VanA2026' });

      // Normalised to one case: /go/vana2026 and /go/VANA2026 are the same
      // link to anyone typing it off a video.
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VANA2026', partnerId: 5 }),
      );
    });

    it('should refuse a code somebody else already has', async () => {
      const { service } = buildService('VANA2026');

      await expect(
        service.createLink(5, { label: 'TikTok', code: 'VANA2026' }),
      ).rejects.toMatchObject({
        response: { errors: { code: expect.any(String) } },
      });
    });

    it('should still generate a code when the partner does not pick one', async () => {
      const { service, save } = buildService(null);

      await service.createLink(5, { label: 'TikTok' });

      const saved = save.mock.calls[0][0] as { code: string };
      expect(saved.code).toMatch(/^[A-Z0-9]{6,}$/);
    });

    it('should not hand out a code that only a deleted link holds', async () => {
      const { service, linkRepository } = buildService('VANA2026');

      await expect(
        service.createLink(5, { label: 'TikTok', code: 'vana2026' }),
      ).rejects.toBeDefined();

      // A soft-deleted link keeps the unique index, so reusing its code would
      // fail at the database with a 500 instead of a readable message.
      expect(linkRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ withDeleted: true }),
      );
    });
  });

  describe('valid vs invalid orders', () => {
    it('should count a credited commission on a paid order', () => {
      expect(classifyPartnerOrder('paid', 'credited')).toEqual({
        validity: 'valid',
        invalidReason: null,
      });
    });

    it('should not count a cancelled order', () => {
      expect(classifyPartnerOrder('cancelled', 'pending')).toEqual({
        validity: 'invalid',
        invalidReason: 'order_cancelled',
      });
    });

    it('should not count an order whose commission was taken back', () => {
      // A refund reverses the commission; the row must say so, not vanish.
      expect(classifyPartnerOrder('refunded', 'reversed')).toEqual({
        validity: 'invalid',
        invalidReason: 'commission_reversed',
      });
    });

    it('should not count an attributed order that earned no commission', () => {
      expect(classifyPartnerOrder('paid', null)).toEqual({
        validity: 'invalid',
        invalidReason: 'no_commission',
      });
    });

    it('should call an order still on its way pending, not invalid', () => {
      // Paid but not yet reconciled — telling the partner "invalid" here would
      // be wrong and would cost a support message every single time.
      expect(classifyPartnerOrder('paid', 'pending')).toEqual({
        validity: 'pending',
        invalidReason: null,
      });
      expect(classifyPartnerOrder('pending', 'pending')).toEqual({
        validity: 'pending',
        invalidReason: null,
      });
    });

    it('should put a reversal ahead of the order status', () => {
      // Reversed on an otherwise fine order (manual clawback, fraud review):
      // the reason the partner needs is the reversal.
      expect(classifyPartnerOrder('completed', 'reversed')).toEqual({
        validity: 'invalid',
        invalidReason: 'commission_reversed',
      });
    });
  });
});
