import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

/** SECURITY 12/11/2026 — OTP guessing and partner sign-in by OTP. */
function makeService(opts: { mayTry: boolean; partnerBlocked?: boolean }) {
  const service = Object.create(AuthService.prototype) as AuthService;
  const claimAttempt = jest.fn().mockResolvedValue(opts.mayTry);
  const compare = jest.spyOn(bcrypt, 'compare');
  Object.assign(service as unknown as Record<string, unknown>, {
    usersService: {
      findByEmail: jest.fn().mockResolvedValue({ id: 3, role: { id: 2 } }),
    },
    otpService: {
      findActiveByUserId: jest.fn().mockResolvedValue({
        id: 1,
        otpHash: 'x',
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      claimAttempt,
      deleteByUserId: jest.fn(),
    },
    assertPartnerMaySignIn: jest.fn(() =>
      opts.partnerBlocked ? Promise.reject(new Error('pending')) : undefined,
    ),
    sessionService: { create: jest.fn().mockResolvedValue({ id: 9 }) },
    getTokensData: jest.fn().mockResolvedValue({
      token: 't',
      refreshToken: 'r',
      tokenExpires: 1,
    }),
  });
  return { service, claimAttempt, compare };
}

describe('verifyOtp (security 12/11/2026)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('should count the attempt before comparing, and stop at the limit', async () => {
    const { service, compare } = makeService({ mayTry: false });
    await expect(service.verifyOtp('a@b.c', '123456')).rejects.toThrow();
    expect(compare).not.toHaveBeenCalled();
  });

  it('should not let a pending partner sign in with a right code', async () => {
    const { service } = makeService({ mayTry: true, partnerBlocked: true });
    jest
      .spyOn(bcrypt, 'compare')
      .mockImplementation(() => Promise.resolve(true));
    await expect(service.verifyOtp('a@b.c', '123456')).rejects.toThrow(
      'pending',
    );
  });
});
