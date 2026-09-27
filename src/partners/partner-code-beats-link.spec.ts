import { PartnersService } from './partners.service';

/**
 * A referral code beats a referral link (#033).
 *
 * The customer may have opened partner A's link days ago, but typing partner
 * B's code at checkout is the deliberate act — the brief gives that order to B.
 * Only a code that belongs to a partner counts; the house's own codes leave
 * attribution where it was.
 */

function buildService(coupon: Record<string, unknown> | null) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const findOne = jest.fn().mockResolvedValue(coupon);
  Object.assign(service, { couponRepository: { findOne } });
  return { service, findOne };
}

describe('PartnersService — whose code was typed (#033)', () => {
  it('should name the partner a code belongs to', async () => {
    const { service, findOne } = buildService({ partnerId: 8, isActive: true });

    await expect(service.resolvePartnerForCoupon(' vana2026 ')).resolves.toBe(
      8,
    );
    // Codes are stored upper-case; the buyer types them however they like.
    expect(findOne).toHaveBeenCalledWith({ where: { code: 'VANA2026' } });
  });

  it('should ignore a house code, which belongs to nobody', async () => {
    const { service } = buildService({ partnerId: null, isActive: true });

    await expect(service.resolvePartnerForCoupon('SALE10')).resolves.toBeNull();
  });

  it('should ignore a code the partner has switched off', async () => {
    const { service } = buildService({ partnerId: 8, isActive: false });

    await expect(
      service.resolvePartnerForCoupon('VANA2026'),
    ).resolves.toBeNull();
  });

  it('should not look anything up when no code was used', async () => {
    const { service, findOne } = buildService(null);

    await expect(service.resolvePartnerForCoupon('  ')).resolves.toBeNull();
    await expect(service.resolvePartnerForCoupon(null)).resolves.toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });
});
