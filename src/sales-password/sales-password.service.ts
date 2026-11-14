import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { MailService } from '../mail/mail.service';

/**
 * "Mật khẩu bán hàng" (vande-1411 #004).
 *
 * Someone guessed an account's sign-in password and placed orders with it.
 * Every transaction that moves money now also asks for a second password,
 * set in the profile:
 *
 * - kept as a bcrypt hash only; neither it nor its code is ever logged;
 * - 5 wrong tries lock it for 15 minutes, counted in one UPDATE so that
 *   parallel guesses cannot each see a fresh counter;
 * - setting it the first time, and resetting a forgotten one, take a code
 *   mailed to the account's email: the sign-in password alone, which is what
 *   the attacker had, is not enough;
 * - changing it takes the current one;
 * - it may not be the sign-in password.
 */
export const SALES_PASSWORD_HEADER = 'x-sales-password';
export const SALES_PASSWORD_MIN_LENGTH = 6;
export const SALES_PASSWORD_MAX_TRIES = 5;
export const SALES_PASSWORD_LOCK_MINUTES = 15;
export const SALES_PASSWORD_CODE_MINUTES = 15;
export const SALES_PASSWORD_CODE_MAX_TRIES = 5;

/** Why a transaction was stopped; the admin app reads `errors.salesPassword`. */
export type SalesPasswordRefusal =
  | 'required'
  | 'invalid'
  | 'not_set'
  | 'locked';

export function salesPasswordRefusal(
  reason: SalesPasswordRefusal,
  message: string,
): HttpException {
  return new HttpException(
    {
      status: HttpStatus.FORBIDDEN,
      message,
      errors: { salesPassword: reason },
    },
    HttpStatus.FORBIDDEN,
  );
}

type Row = {
  email: string | null;
  password: string | null;
  salesPasswordHash: string | null;
  salesPasswordSetAt: Date | null;
  salesPasswordFailedCount: number;
  salesPasswordLockedUntil: Date | null;
  salesPasswordCodeHash: string | null;
  salesPasswordCodeExpiresAt: Date | null;
  salesPasswordCodeAttempts: number;
};

@Injectable()
export class SalesPasswordService {
  private readonly logger = new Logger(SalesPasswordService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  private async row(userId: number): Promise<Row> {
    const [row] = await this.dataSource.query(
      `SELECT email, password, "salesPasswordHash", "salesPasswordSetAt",
              "salesPasswordFailedCount", "salesPasswordLockedUntil",
              "salesPasswordCodeHash", "salesPasswordCodeExpiresAt",
              "salesPasswordCodeAttempts"
         FROM "user" WHERE id = $1 AND "deletedAt" IS NULL`,
      [userId],
    );
    if (!row) throw new ForbiddenException('Tài khoản không tồn tại.');
    return row as Row;
  }

  /** For the profile: set or not, since when, locked until when. */
  async status(userId: number) {
    const row = await this.row(userId);
    const locked =
      row.salesPasswordLockedUntil &&
      new Date(row.salesPasswordLockedUntil) > new Date()
        ? new Date(row.salesPasswordLockedUntil).toISOString()
        : null;
    return {
      isSet: !!row.salesPasswordHash,
      setAt: row.salesPasswordSetAt
        ? new Date(row.salesPasswordSetAt).toISOString()
        : null,
      lockedUntil: locked,
      minLength: SALES_PASSWORD_MIN_LENGTH,
    };
  }

  /**
   * The gate of every money transaction. Throws a 403 that says what is
   * missing; resolves when the password is right.
   */
  async verify(
    userId: number,
    given: string | null | undefined,
  ): Promise<void> {
    const row = await this.row(userId);
    if (!row.salesPasswordHash) {
      throw salesPasswordRefusal(
        'not_set',
        'Tài khoản chưa có mật khẩu bán hàng. Vào Hồ sơ → "Mật khẩu bán hàng" để tạo trước khi thực hiện giao dịch.',
      );
    }
    this.assertNotLocked(row);
    if (!given) {
      throw salesPasswordRefusal(
        'required',
        'Nhập mật khẩu bán hàng để thực hiện giao dịch này.',
      );
    }
    if (await bcrypt.compare(given, row.salesPasswordHash)) {
      if (row.salesPasswordFailedCount > 0) {
        await this.dataSource.query(
          `UPDATE "user" SET "salesPasswordFailedCount" = 0,
                  "salesPasswordLockedUntil" = NULL WHERE id = $1`,
          [userId],
        );
      }
      return;
    }
    // One statement: parallel wrong guesses each add one.
    const [counted] = await this.dataSource.query(
      `UPDATE "user"
          SET "salesPasswordFailedCount" = "salesPasswordFailedCount" + 1,
              "salesPasswordLockedUntil" = CASE
                WHEN "salesPasswordFailedCount" + 1 >= $2
                THEN now() + make_interval(mins => $3) ELSE NULL END
        WHERE id = $1
        RETURNING "salesPasswordFailedCount" AS n`,
      [userId, SALES_PASSWORD_MAX_TRIES, SALES_PASSWORD_LOCK_MINUTES],
    );
    const n = Number(counted?.[0]?.n ?? counted?.n ?? 0);
    this.logger.warn(`Wrong sales password for user ${userId} (${n} in a row)`);
    if (n >= SALES_PASSWORD_MAX_TRIES) {
      throw salesPasswordRefusal(
        'locked',
        `Nhập sai mật khẩu bán hàng ${SALES_PASSWORD_MAX_TRIES} lần, tạm khoá ${SALES_PASSWORD_LOCK_MINUTES} phút. Có thể đặt lại bằng mã gửi qua email.`,
      );
    }
    throw salesPasswordRefusal(
      'invalid',
      `Mật khẩu bán hàng không đúng (còn ${SALES_PASSWORD_MAX_TRIES - n} lần thử).`,
    );
  }

  private assertNotLocked(row: Row) {
    if (
      row.salesPasswordLockedUntil &&
      new Date(row.salesPasswordLockedUntil) > new Date()
    ) {
      const until = new Date(row.salesPasswordLockedUntil).toLocaleTimeString(
        'vi-VN',
        { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' },
      );
      throw salesPasswordRefusal(
        'locked',
        `Mật khẩu bán hàng đang tạm khoá tới ${until} do nhập sai nhiều lần. Có thể đặt lại bằng mã gửi qua email.`,
      );
    }
  }

  /** Mail a code that sets (first time) or resets the password. */
  async requestCode(userId: number): Promise<{ sentTo: string }> {
    const row = await this.row(userId);
    if (!row.email) {
      throw new BadRequestException('Tài khoản chưa có email để nhận mã.');
    }
    // One code a minute at most.
    if (
      row.salesPasswordCodeExpiresAt &&
      new Date(row.salesPasswordCodeExpiresAt).getTime() -
        (SALES_PASSWORD_CODE_MINUTES - 1) * 60_000 >
        Date.now()
    ) {
      throw new HttpException(
        'Vừa gửi mã, vui lòng chờ 1 phút rồi gửi lại.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.dataSource.query(
      `UPDATE "user" SET "salesPasswordCodeHash" = $2,
              "salesPasswordCodeExpiresAt" = now() + make_interval(mins => $3),
              "salesPasswordCodeAttempts" = 0
        WHERE id = $1`,
      [userId, await bcrypt.hash(code, 10), SALES_PASSWORD_CODE_MINUTES],
    );
    await this.mailService.sendSalesPasswordCode({
      to: row.email,
      code,
      expiresInMinutes: SALES_PASSWORD_CODE_MINUTES,
      isReset: !!row.salesPasswordHash,
    });
    return { sentTo: maskEmail(row.email) };
  }

  /** Set or reset it with the mailed code. */
  async setWithCode(
    userId: number,
    code: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const row = await this.row(userId);
    if (
      !row.salesPasswordCodeHash ||
      !row.salesPasswordCodeExpiresAt ||
      new Date(row.salesPasswordCodeExpiresAt) < new Date()
    ) {
      throw new BadRequestException('Mã đã hết hạn, vui lòng gửi mã mới.');
    }
    const [counted] = await this.dataSource.query(
      `UPDATE "user" SET "salesPasswordCodeAttempts" = "salesPasswordCodeAttempts" + 1
        WHERE id = $1 RETURNING "salesPasswordCodeAttempts" AS n`,
      [userId],
    );
    const n = Number(counted?.[0]?.n ?? counted?.n ?? 0);
    if (n > SALES_PASSWORD_CODE_MAX_TRIES) {
      throw new BadRequestException(
        'Nhập sai mã quá nhiều lần, vui lòng gửi mã mới.',
      );
    }
    if (
      !(await bcrypt.compare(
        String(code ?? '').trim(),
        row.salesPasswordCodeHash,
      ))
    ) {
      throw new BadRequestException('Mã xác nhận không đúng.');
    }
    await this.store(userId, row, newPassword);
    return { ok: true };
  }

  /** Change it, knowing the current one. */
  async change(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    await this.verify(userId, currentPassword);
    await this.store(userId, await this.row(userId), newPassword);
    return { ok: true };
  }

  private async store(userId: number, row: Row, newPassword: string) {
    const value = String(newPassword ?? '');
    if (value.length < SALES_PASSWORD_MIN_LENGTH || value.length > 72) {
      throw new BadRequestException(
        `Mật khẩu bán hàng cần từ ${SALES_PASSWORD_MIN_LENGTH} đến 72 ký tự.`,
      );
    }
    if (row.password && (await bcrypt.compare(value, row.password))) {
      throw new BadRequestException(
        'Mật khẩu bán hàng không được trùng mật khẩu đăng nhập.',
      );
    }
    await this.dataSource.query(
      `UPDATE "user" SET "salesPasswordHash" = $2, "salesPasswordSetAt" = now(),
              "salesPasswordFailedCount" = 0, "salesPasswordLockedUntil" = NULL,
              "salesPasswordCodeHash" = NULL, "salesPasswordCodeExpiresAt" = NULL,
              "salesPasswordCodeAttempts" = 0
        WHERE id = $1`,
      [userId, await bcrypt.hash(value, 10)],
    );
    this.logger.log(`Sales password set for user ${userId}`);
  }
}

/** "m***@example.com" — where the code went, without spelling it out. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return '***';
  return `${name.slice(0, 1)}***@${domain}`;
}
