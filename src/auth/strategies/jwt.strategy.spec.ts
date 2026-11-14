import { UnauthorizedException } from '@nestjs/common';
import {
  ACCOUNT_LOCKED_MESSAGE,
  JwtStrategy,
  PARTNER_LOCKED_MESSAGE,
} from './jwt.strategy';
import { PartnerStatusEnum } from '../../partners/partners.enum';

function build(
  session: unknown,
  partner: unknown,
  account: unknown = { id: 1, lockedAt: null },
) {
  const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
  Object.assign(strategy, {
    sessionService: { findById: jest.fn().mockResolvedValue(session) },
    partnersRepository: { findOne: jest.fn().mockResolvedValue(partner) },
    usersRepository: { findOne: jest.fn().mockResolvedValue(account) },
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

  it('should not look up a session or partner for an admin', async () => {
    const strategy = build(null, null);
    const admin = { id: 1, role: { id: 1 }, sessionId: 0, iat: 0, exp: 0 };
    await expect(strategy.validate(admin as never)).resolves.toBe(admin);
  });
});

describe('JwtStrategy — locked accounts (security 15/11/2026)', () => {
  const customer = { id: 349, role: { id: 2 }, sessionId: 7, iat: 0, exp: 0 };

  it('should refuse a live token of a locked account', async () => {
    const strategy = build(null, null, { id: 349, lockedAt: new Date() });
    await expect(strategy.validate(customer as never)).rejects.toThrow(
      ACCOUNT_LOCKED_MESSAGE,
    );
  });

  it('should refuse a token of a deleted account', async () => {
    const strategy = build(null, null, null);
    await expect(strategy.validate(customer as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should accept an account that is not locked', async () => {
    const strategy = build(null, null);
    await expect(strategy.validate(customer as never)).resolves.toBe(customer);
  });
});
