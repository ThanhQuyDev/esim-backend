import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, PARTNER_LOCKED_MESSAGE } from './jwt.strategy';
import { PartnerStatusEnum } from '../../partners/partners.enum';

function build(session: unknown, partner: unknown) {
  const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
  Object.assign(strategy, {
    sessionService: { findById: jest.fn().mockResolvedValue(session) },
    partnersRepository: { findOne: jest.fn().mockResolvedValue(partner) },
  });
  return strategy;
}

const partnerPayload = {
  id: 18,
  role: { id: 4 },
  sessionId: 5,
  iat: 0,
  exp: 0,
};

describe('JwtStrategy — partner sign-out (doitac-1410 #004)', () => {
  it('should accept a partner whose session is still there', async () => {
    const strategy = build({ id: 5 }, { status: PartnerStatusEnum.ACTIVE });
    await expect(strategy.validate(partnerPayload as never)).resolves.toBe(
      partnerPayload,
    );
  });

  it('should reject a partner whose sessions were deleted', async () => {
    const strategy = build(null, { status: PartnerStatusEnum.ACTIVE });
    await expect(strategy.validate(partnerPayload as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should tell a locked partner why, even with a live token', async () => {
    const strategy = build({ id: 5 }, { status: PartnerStatusEnum.DISABLED });
    await expect(strategy.validate(partnerPayload as never)).rejects.toThrow(
      PARTNER_LOCKED_MESSAGE,
    );
  });

  it('should not look anything up for an admin', async () => {
    const strategy = build(null, null);
    const admin = { id: 1, role: { id: 1 }, sessionId: 0, iat: 0, exp: 0 };
    await expect(strategy.validate(admin as never)).resolves.toBe(admin);
  });
});
