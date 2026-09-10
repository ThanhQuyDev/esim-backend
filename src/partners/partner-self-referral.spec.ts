import { PartnersService, classifyPartnerOrder } from './partners.service';

/**
 * A partner buying through their own link (#095).
 *
 * The brief asks for exactly this guard: "tránh trường hợp tạo xong link giới
 * thiệu rồi tự tạo tài khoản mới để đặt hàng kiếm hoa hồng". Nothing checked
 * it, so a partner could take their own commission off every order they placed
 * — a permanent private discount, paid out of the shop's margin.
 *
 * Only the unambiguous half is covered here: the buyer IS the partner's own
 * account. The same-IP-different-account case is a judgement call (a hotel or
 * office network shares one address) and is still waiting on Thọ.
 */
describe('PartnersService — self-referral', () => {
  const PARTNER = { id: 5, userId: 11, tierCode: 'silver' };

  function buildService() {
    const commissionRepository = {
      create: jest.fn().mockImplementation((row) => row),
      save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
    };

    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      logger: { warn: jest.fn(), error: jest.fn() },
      partnerRepository: { findOne: jest.fn().mockResolvedValue(PARTNER) },
      tierRepository: {
        findOne: jest.fn().mockResolvedValue({ commissionPercent: 5 }),
      },
      commissionRepository,
    });

    return { service, commissionRepository };
  }

  it('should not pay a partner for their own order', async () => {
    const { service, commissionRepository } = buildService();

    const result = await service.createPendingCommissionForOrder({
      orderId: 1,
      partnerId: 5,
      linkId: 2,
      orderValueVnd: 1_000_000,
      buyerUserId: 11,
    });

    expect(result).toBeNull();
    expect(commissionRepository.save).not.toHaveBeenCalled();
  });

  it('should still pay for an order somebody else placed', async () => {
    const { service, commissionRepository } = buildService();

    const result = await service.createPendingCommissionForOrder({
      orderId: 1,
      partnerId: 5,
      linkId: 2,
      orderValueVnd: 1_000_000,
      buyerUserId: 99,
    });

    expect(result).not.toBeNull();
    expect(commissionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ commissionVnd: 50_000 }),
    );
  });

  it('should still pay when the buyer was not signed in', async () => {
    const { service, commissionRepository } = buildService();

    // A guest checkout has no account to compare; refusing here would drop
    // commission on real orders to catch a case we cannot even see.
    await service.createPendingCommissionForOrder({
      orderId: 1,
      partnerId: 5,
      linkId: 2,
      orderValueVnd: 1_000_000,
      buyerUserId: null,
    });

    expect(commissionRepository.save).toHaveBeenCalled();
  });

  it('should log loudly when an approved partner has no rate to earn at', async () => {
    // Approving does not assign a tier and the rate lives on the tier, so this
    // is the state every freshly approved partner starts in: every order
    // earning zero, with nothing in reconciliation to explain it.
    const { service, commissionRepository } = buildService();
    const warn = jest.fn();
    Object.assign(service, {
      logger: { warn, error: jest.fn() },
      partnerRepository: {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 5, userId: 11, tierCode: null }),
      },
      tierRepository: { findOne: jest.fn().mockResolvedValue(null) },
    });

    const result = await service.createPendingCommissionForOrder({
      orderId: 42,
      partnerId: 5,
      linkId: 2,
      orderValueVnd: 1_000_000,
      buyerUserId: 99,
    });

    expect(result).toBeNull();
    expect(commissionRepository.save).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no commission'));
  });

  it('should tell the partner why their own order earned nothing', () => {
    expect(classifyPartnerOrder('completed', null, true)).toEqual({
      validity: 'invalid',
      invalidReason: 'self_referral',
    });
  });

  it('should give the self-referral reason ahead of the vaguer ones', () => {
    // "This order earned no commission" is true but leaves the partner
    // guessing; the specific reason is the one they can act on.
    expect(classifyPartnerOrder('paid', 'pending', true).invalidReason).toBe(
      'self_referral',
    );
  });

  it('should leave an ordinary order classified as before', () => {
    expect(classifyPartnerOrder('completed', 'credited', false)).toEqual({
      validity: 'valid',
      invalidReason: null,
    });
  });
});
