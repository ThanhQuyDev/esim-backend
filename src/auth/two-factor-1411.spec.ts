import bcrypt from 'bcryptjs';
import { RoleEnum } from '../roles/roles.enum';
import { AuthService } from './auth.service';
import { TwoFactorService, twoFactorApplies } from './two-factor.service';

/**
 * vande-1411 #005: with two-step sign-in on, the right password mails a code
 * instead of opening a session, and the ways in that skip the password are
 * closed for that account.
 */
describe('Đăng nhập 2 lớp bằng OTP (vande-1411 #005)', () => {
  const PASSWORD = 'mat-khau-dang-nhap';

  /** A user table of one row, enough for the service's SQL. */
  function fakeDb(row: Record<string, unknown>) {
    return {
      query: jest.fn((sql: string, params: unknown[]) => {
        if (sql.startsWith('SELECT')) {
          if (sql.includes('"twoFactorChallengeHash" = $1')) {
            return Promise.resolve(
              row.twoFactorChallengeHash === params[0] ? [{ ...row }] : [],
            );
          }
          return Promise.resolve([{ ...row }]);
        }
        if (sql.includes('"twoFactorAttempts" + 1')) {
          row.twoFactorAttempts = Number(row.twoFactorAttempts ?? 0) + 1;
          return Promise.resolve([[{ n: row.twoFactorAttempts }], 1]);
        }
        if (sql.includes('"twoFactorChallengeHash" = $2')) {
          row.twoFactorChallengeHash = params[1];
          row.twoFactorCodeHash = params[2];
          row.twoFactorExpiresAt = new Date(Date.now() + 600_000);
          row.twoFactorAttempts = 0;
        }
        if (sql.includes('"twoFactorChallengeHash" = NULL')) {
          row.twoFactorChallengeHash = null;
          row.twoFactorCodeHash = null;
        }
        return Promise.resolve([]);
      }),
    };
  }

  async function build(enabled: boolean, roleId = RoleEnum.admin) {
    const user = {
      id: 5,
      email: 'admin@example.com',
      password: await bcrypt.hash(PASSWORD, 4),
      role: { id: roleId },
    };
    const row: Record<string, unknown> = {
      id: 5,
      email: user.email,
      twoFactorEnabled: enabled,
    };
    const mail = { sendTwoFactorCode: jest.fn() };
    const twoFactor = new TwoFactorService(fakeDb(row) as never, mail as never);
    const service = Object.create(AuthService.prototype) as AuthService;
    const sessions: unknown[] = [];
    Object.assign(service as unknown as Record<string, unknown>, {
      twoFactor,
      usersService: {
        findByEmail: jest.fn().mockResolvedValue(user),
        findById: jest.fn().mockResolvedValue(user),
        markSignedIn: jest.fn().mockResolvedValue(undefined),
      },
      sessionService: {
        create: jest.fn((a: unknown) => {
          sessions.push(a);
          return Promise.resolve({ id: 1 });
        }),
      },
      partnersRepository: { findOne: jest.fn() },
      getTokensData: jest
        .fn()
        .mockResolvedValue({ token: 't', refreshToken: 'r', tokenExpires: 1 }),
    });
    return { service, sessions, mail, row };
  }

  it('should sign in at once with two-step off', async () => {
    const { service, sessions } = await build(false);
    const result = await service.validateLogin({
      email: 'admin@example.com',
      password: PASSWORD,
    });
    expect(result).toMatchObject({ token: 't' });
    expect(sessions).toHaveLength(1);
  });

  it('should mail a code and open no session yet with two-step on', async () => {
    const { service, sessions, mail } = await build(true);
    const result = await service.validateLogin({
      email: 'admin@example.com',
      password: PASSWORD,
    });
    expect(result).toMatchObject({
      twoFactorRequired: true,
      sentTo: 'a***@example.com',
    });
    expect(result).not.toHaveProperty('token');
    expect(sessions).toHaveLength(0);
    expect(mail.sendTwoFactorCode).toHaveBeenCalledTimes(1);
  });

  it('should open the session only with the mailed code', async () => {
    const { service, sessions, mail } = await build(true);
    const step1 = (await service.validateLogin({
      email: 'admin@example.com',
      password: PASSWORD,
    })) as { challenge: string };
    const code = mail.sendTwoFactorCode.mock.calls[0][0].code as string;
    const wrong = code === '000000' ? '111111' : '000000';

    await expect(
      service.completeTwoFactorLogin(step1.challenge, wrong),
    ).rejects.toMatchObject({ response: { errors: { otp: 'otpInvalid' } } });
    expect(sessions).toHaveLength(0);

    const result = await service.completeTwoFactorLogin(step1.challenge, code);
    expect(result).toMatchObject({ token: 't' });
    expect(sessions).toHaveLength(1);
    // The challenge is spent: it cannot open a second session.
    await expect(
      service.completeTwoFactorLogin(step1.challenge, code),
    ).rejects.toMatchObject({ response: { errors: { otp: 'otpExpired' } } });
  });

  it('should end the challenge after 5 wrong codes', async () => {
    const { service, mail } = await build(true);
    const step1 = (await service.validateLogin({
      email: 'admin@example.com',
      password: PASSWORD,
    })) as { challenge: string };
    const code = mail.sendTwoFactorCode.mock.calls[0][0].code as string;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await expect(
        service.completeTwoFactorLogin(step1.challenge, wrong),
      ).rejects.toBeDefined();
    }
    await expect(
      service.completeTwoFactorLogin(step1.challenge, code),
    ).rejects.toMatchObject({
      response: { errors: { otp: 'otpMaxAttemptsExceeded' } },
    });
  });

  it('should close the email-code and Google sign-in with two-step on', async () => {
    const on = await build(true);
    await expect(
      (
        on.service as unknown as { twoFactor: TwoFactorService }
      ).twoFactor.assertNoBypass({ id: 5 }),
    ).rejects.toMatchObject({
      response: { errors: { email: 'twoFactorPasswordRequired' } },
    });
    const off = await build(false);
    await expect(
      (
        off.service as unknown as { twoFactor: TwoFactorService }
      ).twoFactor.assertNoBypass({ id: 5 }),
    ).resolves.toBeUndefined();
  });

  it('should apply to admins and partners, not to shoppers', () => {
    expect(twoFactorApplies({ role: { id: RoleEnum.admin } })).toBe(true);
    expect(twoFactorApplies({ role: { id: RoleEnum.partner } })).toBe(true);
    expect(twoFactorApplies({ role: { id: RoleEnum.user } })).toBe(false);
  });
});
