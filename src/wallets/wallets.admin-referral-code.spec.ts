import { BadRequestException } from '@nestjs/common';
import {
  ADMIN_REFERRAL_CODE_PATTERN,
  CUSTOMER_REFERRAL_CODE_PATTERN,
  WalletsService,
} from './wallets.service';

/**
 * Admins set a customer's referral code from the CMS (#026) without the
 * exactly-10-characters rule customers follow on the storefront.
 */

type Profile = { id: number; userId: number; code: string; isActive: boolean };

function makeService(profiles: Profile[]) {
  const referralProfileRepository = {
    findOne: jest.fn(
      ({ where }: { where: { userId?: number; code?: string } }) =>
        Promise.resolve(
          profiles.find((profile) =>
            where.code !== undefined
              ? profile.code === where.code
              : profile.userId === where.userId,
          ) ?? null,
        ),
    ),
    save: jest.fn((profile: Profile) => Promise.resolve(profile)),
    create: jest.fn((profile: Profile) => profile),
  };

  const service = new WalletsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    referralProfileRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, referralProfileRepository };
}

describe('Referral code rules', () => {
  it('should keep customers to exactly 10 letters or digits', () => {
    expect(CUSTOMER_REFERRAL_CODE_PATTERN.test('ABCDE12345')).toBe(true);
    expect(CUSTOMER_REFERRAL_CODE_PATTERN.test('VIP')).toBe(false);
  });

  it.each(['VIP', 'ABCDE12345', 'PARTNERBRAND2026', 'A'.repeat(50)])(
    'should let an admin set %s',
    (code) => {
      expect(ADMIN_REFERRAL_CODE_PATTERN.test(code)).toBe(true);
    },
  );

  it.each(['AB', 'A'.repeat(51), 'VIP-1', 'MÃ123'])(
    'should refuse %s even from an admin',
    (code) => {
      expect(ADMIN_REFERRAL_CODE_PATTERN.test(code)).toBe(false);
    },
  );
});

describe('WalletsService.adminUpdateReferralCode (#026)', () => {
  it('should save a short code, uppercased', async () => {
    const { service, referralProfileRepository } = makeService([
      { id: 1, userId: 7, code: 'OLDCODE123', isActive: true },
    ]);

    await expect(service.adminUpdateReferralCode(7, ' vip ')).resolves.toEqual({
      userId: 7,
      code: 'VIP',
      isActive: true,
    });
    expect(referralProfileRepository.save).toHaveBeenCalled();
  });

  it('should refuse a code another customer already has', async () => {
    const { service, referralProfileRepository } = makeService([
      { id: 1, userId: 7, code: 'OLDCODE123', isActive: true },
      { id: 2, userId: 8, code: 'VIP', isActive: true },
    ]);

    await expect(
      service.adminUpdateReferralCode(7, 'vip'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(referralProfileRepository.save).not.toHaveBeenCalled();
  });

  it('should still hold customers to the 10-character rule', async () => {
    const { service } = makeService([
      { id: 1, userId: 7, code: 'OLDCODE123', isActive: true },
    ]);

    await expect(service.updateReferralCode(7, 'VIP')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
