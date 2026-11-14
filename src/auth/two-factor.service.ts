import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { RoleEnum } from '../roles/roles.enum';
import { maskEmail } from '../sales-password/sales-password.service';

/**
 * "Đăng nhập 2 lớp bằng OTP" (vande-1411 #005).
 *
 * An admin or a partner may switch it on in the profile. Then the right
 * password no longer opens a session by itself: a 6-digit code goes to the
 * account's email, and the session is made only when it comes back with the
 * challenge the password step handed out. The code and the challenge are kept
 * hashed; 5 wrong codes end the challenge; a code lives 10 minutes.
 *
 * With it on, the ways in that skip the password — the email-code sign-in and
 * Google — are closed for that account, or they would walk round it.
 * Switching it off takes a code mailed to the account too.
 */
export const TWO_FACTOR_CODE_MINUTES = 10;
export const TWO_FACTOR_MAX_TRIES = 5;

export type TwoFactorChallenge = {
  twoFactorRequired: true;
  /** Sent back with the code; proves the password step was passed. */
  challenge: string;
  sentTo: string;
  expiresInMinutes: number;
};

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

/** Who may turn it on: the CMS and the partner portal, not shoppers. */
export function twoFactorApplies(user: {
  role?: { id?: number | string } | null;
  extraRoleIds?: (number | string)[] | null;
}): boolean {
  const roles = [user.role?.id, ...(user.extraRoleIds ?? [])].map(Number);
  return roles.includes(RoleEnum.admin) || roles.includes(RoleEnum.partner);
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  async isEnabled(userId: number | string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT "twoFactorEnabled" FROM "user" WHERE id = $1`,
      [Number(userId)],
    );
    return !!row?.twoFactorEnabled;
  }

  /** After the right password: mail a code instead of opening a session. */
  async startChallenge(user: {
    id: number | string;
    email?: string | null;
  }): Promise<TwoFactorChallenge> {
    if (!user.email) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: 'twoFactorNoEmail' },
      });
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const challenge = crypto.randomBytes(32).toString('hex');
    await this.dataSource.query(
      `UPDATE "user" SET "twoFactorChallengeHash" = $2,
              "twoFactorCodeHash" = $3,
              "twoFactorExpiresAt" = now() + make_interval(mins => $4),
              "twoFactorAttempts" = 0
        WHERE id = $1`,
      [
        Number(user.id),
        sha256(challenge),
        await bcrypt.hash(code, 10),
        TWO_FACTOR_CODE_MINUTES,
      ],
    );
    await this.mailService.sendTwoFactorCode({
      to: user.email,
      code,
      expiresInMinutes: TWO_FACTOR_CODE_MINUTES,
      purpose: 'login',
    });
    return {
      twoFactorRequired: true,
      challenge,
      sentTo: maskEmail(user.email),
      expiresInMinutes: TWO_FACTOR_CODE_MINUTES,
    };
  }

  /** A new code for the same challenge, at most one a minute. */
  async resend(challenge: string): Promise<{ sentTo: string }> {
    const [row] = await this.dataSource.query(
      `SELECT id, email, "twoFactorExpiresAt" FROM "user"
        WHERE "twoFactorChallengeHash" = $1 AND "deletedAt" IS NULL`,
      [sha256(String(challenge ?? ''))],
    );
    if (!row?.email) throw this.expired();
    const issuedAt =
      new Date(row.twoFactorExpiresAt).getTime() -
      TWO_FACTOR_CODE_MINUTES * 60_000;
    if (Date.now() - issuedAt < 60_000) {
      throw new HttpException(
        'Vừa gửi mã, vui lòng chờ 1 phút rồi gửi lại.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await this.dataSource.query(
      `UPDATE "user" SET "twoFactorCodeHash" = $2,
              "twoFactorExpiresAt" = now() + make_interval(mins => $3),
              "twoFactorAttempts" = 0
        WHERE id = $1`,
      [row.id, await bcrypt.hash(code, 10), TWO_FACTOR_CODE_MINUTES],
    );
    await this.mailService.sendTwoFactorCode({
      to: row.email,
      code,
      expiresInMinutes: TWO_FACTOR_CODE_MINUTES,
      purpose: 'login',
    });
    return { sentTo: maskEmail(row.email) };
  }

  /** The user the challenge belongs to, once the code is right. */
  async verifyChallenge(challenge: string, code: string): Promise<number> {
    const [row] = await this.dataSource.query(
      `SELECT id, "twoFactorCodeHash", "twoFactorExpiresAt" FROM "user"
        WHERE "twoFactorChallengeHash" = $1 AND "deletedAt" IS NULL`,
      [sha256(String(challenge ?? ''))],
    );
    if (
      !row?.twoFactorCodeHash ||
      new Date(row.twoFactorExpiresAt) < new Date()
    ) {
      throw this.expired();
    }
    // Counted before compared, in one statement: parallel guesses each count.
    const [counted] = await this.dataSource.query(
      `UPDATE "user" SET "twoFactorAttempts" = "twoFactorAttempts" + 1
        WHERE id = $1 RETURNING "twoFactorAttempts" AS n`,
      [row.id],
    );
    const n = Number(counted?.[0]?.n ?? counted?.n ?? 0);
    if (n > TWO_FACTOR_MAX_TRIES) {
      await this.clear(row.id);
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Nhập sai mã quá nhiều lần, vui lòng đăng nhập lại.',
        errors: { otp: 'otpMaxAttemptsExceeded' },
      });
    }
    if (
      !(await bcrypt.compare(String(code ?? '').trim(), row.twoFactorCodeHash))
    ) {
      this.logger.warn(`Wrong sign-in code for user ${row.id} (${n})`);
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: `Mã xác thực không đúng (còn ${TWO_FACTOR_MAX_TRIES - n} lần thử).`,
        errors: { otp: 'otpInvalid' },
      });
    }
    await this.clear(row.id);
    return Number(row.id);
  }

  private async clear(userId: number) {
    await this.dataSource.query(
      `UPDATE "user" SET "twoFactorChallengeHash" = NULL,
              "twoFactorCodeHash" = NULL, "twoFactorExpiresAt" = NULL,
              "twoFactorAttempts" = 0
        WHERE id = $1`,
      [userId],
    );
  }

  private expired() {
    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'Mã đã hết hạn, vui lòng đăng nhập lại.',
      errors: { otp: 'otpExpired' },
    });
  }

  /** The email-code sign-in and Google skip the password: closed when on. */
  async assertNoBypass(user: { id: number | string }): Promise<void> {
    if (await this.isEnabled(user.id)) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message:
          'Tài khoản đã bật đăng nhập 2 lớp: vui lòng đăng nhập bằng email và mật khẩu.',
        errors: { email: 'twoFactorPasswordRequired' },
      });
    }
  }

  // ── Profile ──────────────────────────────────────────────────────────

  async status(userId: number) {
    const [row] = await this.dataSource.query(
      `SELECT email, "twoFactorEnabled" FROM "user" WHERE id = $1`,
      [userId],
    );
    return {
      enabled: !!row?.twoFactorEnabled,
      channel: 'email' as const,
      sentTo: row?.email ? maskEmail(row.email) : null,
    };
  }

  /** Turning it on only makes signing in harder: no proof needed. */
  async enable(userId: number) {
    await this.dataSource.query(
      `UPDATE "user" SET "twoFactorEnabled" = true WHERE id = $1`,
      [userId],
    );
    this.logger.log(`Two-factor sign-in on for user ${userId}`);
    return this.status(userId);
  }

  /** Turning it off: a code mailed to the account first. */
  async requestDisableCode(userId: number): Promise<{ sentTo: string }> {
    const [row] = await this.dataSource.query(
      `SELECT email, "twoFactorDisableExpiresAt" FROM "user" WHERE id = $1`,
      [userId],
    );
    if (!row?.email) {
      throw new BadRequestException('Tài khoản chưa có email để nhận mã.');
    }
    if (
      row.twoFactorDisableExpiresAt &&
      new Date(row.twoFactorDisableExpiresAt).getTime() -
        (TWO_FACTOR_CODE_MINUTES - 1) * 60_000 >
        Date.now()
    ) {
      throw new HttpException(
        'Vừa gửi mã, vui lòng chờ 1 phút rồi gửi lại.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await this.dataSource.query(
      `UPDATE "user" SET "twoFactorDisableCodeHash" = $2,
              "twoFactorDisableExpiresAt" = now() + make_interval(mins => $3),
              "twoFactorDisableAttempts" = 0
        WHERE id = $1`,
      [userId, await bcrypt.hash(code, 10), TWO_FACTOR_CODE_MINUTES],
    );
    await this.mailService.sendTwoFactorCode({
      to: row.email,
      code,
      expiresInMinutes: TWO_FACTOR_CODE_MINUTES,
      purpose: 'disable',
    });
    return { sentTo: maskEmail(row.email) };
  }

  async disable(userId: number, code: string) {
    const [row] = await this.dataSource.query(
      `SELECT "twoFactorDisableCodeHash", "twoFactorDisableExpiresAt"
         FROM "user" WHERE id = $1`,
      [userId],
    );
    if (
      !row?.twoFactorDisableCodeHash ||
      new Date(row.twoFactorDisableExpiresAt) < new Date()
    ) {
      throw new BadRequestException('Mã đã hết hạn, vui lòng gửi mã mới.');
    }
    const [counted] = await this.dataSource.query(
      `UPDATE "user" SET "twoFactorDisableAttempts" = "twoFactorDisableAttempts" + 1
        WHERE id = $1 RETURNING "twoFactorDisableAttempts" AS n`,
      [userId],
    );
    const n = Number(counted?.[0]?.n ?? counted?.n ?? 0);
    if (n > TWO_FACTOR_MAX_TRIES) {
      throw new BadRequestException(
        'Nhập sai mã quá nhiều lần, vui lòng gửi mã mới.',
      );
    }
    if (
      !(await bcrypt.compare(
        String(code ?? '').trim(),
        row.twoFactorDisableCodeHash,
      ))
    ) {
      throw new BadRequestException('Mã xác nhận không đúng.');
    }
    await this.dataSource.query(
      `UPDATE "user" SET "twoFactorEnabled" = false,
              "twoFactorDisableCodeHash" = NULL,
              "twoFactorDisableExpiresAt" = NULL,
              "twoFactorDisableAttempts" = 0
        WHERE id = $1`,
      [userId],
    );
    this.logger.log(`Two-factor sign-in off for user ${userId}`);
    return this.status(userId);
  }
}
