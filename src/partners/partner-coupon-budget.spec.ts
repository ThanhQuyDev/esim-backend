import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * A partner's own discount code (#028).
 *
 * The code is how a partner splits the commission they already earn: keep it,
 * or hand part of it to the customer. The two shares always add up to the
 * original commission — so the discount cannot exceed the partner's own rate,
 * and the code is never advertised on the cart page, unlike the house's own.
 */

function buildService(opts: {
  commissionPercent: number;
  takenCode?: string;
  partnerType?: PartnerTypeEnum;
  /** #048: a distribution partner esim.vn has granted the programme to. */
  canAffiliate?: boolean;
}) {
  const save = jest
    .fn()
    .mockImplementation((row) => Promise.resolve({ id: 7, ...row }));

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 5,
      partnerType: opts.partnerType ?? PartnerTypeEnum.KOL,
      canAffiliate: opts.canAffiliate ?? false,
      tierCode: opts.commissionPercent > 0 ? 'GOLD' : null,
    }),
    tierRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue({ commissionPercent: opts.commissionPercent }),
    },
    couponRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue(opts.takenCode ? { code: opts.takenCode } : null),
      create: (row: unknown) => row,
      save,
    },
  });

  return { service, save };
}

const DTO = {
  code: 'vana2026',
  discountPercent: 5,
  maxDiscountAmount: 50_000,
  minOrderAmount: 500_000,
  maxUsage: 100,
  maxUsagePerUser: 1,
};

describe('PartnersService — a partner funding their own discount (#028)', () => {
  it('should keep the code, normalise it, and hide it from the cart page', async () => {
    const { service, save } = buildService({ commissionPercent: 20 });

    const result = await service.createMyCoupon(5, DTO);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VANA2026',
        partnerId: 5,
        discountPercent: 5,
        maxDiscountAmount: 50_000,
        minOrderAmount: 500_000,
        maxUsage: 100,
        maxUsagePerUser: 1,
        // Customers type a partner's code; only house codes are listed.
        isPublic: false,
      }),
    );
    // 20% earned, 5% given away, 15% kept — the two shares are the commission.
    expect(result.keptPercent).toBe(15);
  });

  it('should refuse a discount larger than the commission it comes from', async () => {
    const { service, save } = buildService({ commissionPercent: 4 });

    await expect(
      service.createMyCoupon(5, { ...DTO, discountPercent: 5 }),
    ).rejects.toMatchObject({
      response: { errors: { discountPercent: expect.stringContaining('4%') } },
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('should refuse a partner with no tier, who has no commission to split', async () => {
    const { service } = buildService({ commissionPercent: 0 });

    await expect(service.createMyCoupon(5, DTO)).rejects.toMatchObject({
      response: { errors: { discountPercent: expect.any(String) } },
    });
  });

  it('should refuse a code somebody already holds', async () => {
    const { service } = buildService({
      commissionPercent: 20,
      takenCode: 'VANA2026',
    });

    await expect(service.createMyCoupon(5, DTO)).rejects.toMatchObject({
      response: { errors: { code: expect.any(String) } },
    });
  });

  it('should refuse a distribution partner who has not been granted the programme', async () => {
    // #048 opened the affiliate programme to a distributor esim.vn has granted
    // it to; without the grant the answer is still no.
    const { service } = buildService({
      commissionPercent: 20,
      partnerType: PartnerTypeEnum.DISTRIBUTION,
    });

    await expect(service.createMyCoupon(5, DTO)).rejects.toThrow(
      'chưa được cấp quyền tiếp thị',
    );
  });

  it('should allow a distribution partner who has been granted it (#048)', async () => {
    const { service } = buildService({
      commissionPercent: 20,
      partnerType: PartnerTypeEnum.DISTRIBUTION,
      canAffiliate: true,
    });

    await expect(service.createMyCoupon(5, DTO)).resolves.toBeDefined();
  });
});
