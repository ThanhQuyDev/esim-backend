import {
  Injectable,
  UnprocessableEntityException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import { EmailChangeRequestEntity } from './entities/email-change-request.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import type { User } from '../users/domain/user';

/** Same window and attempt budget as the login OTP, so the two behave alike. */
const CODE_TTL_MS = 5 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Self-service email change (#057).
 *
 * The customer is looked up by **id** the whole way through — that is what makes
 * changing the address safe, since nothing in the account hangs off the email
 * string itself. The new address is verified first: login is email + OTP, so
 * switching to a mistyped address would lock the customer out of their own eSIMs
 * with no way back.
 */
@Injectable()
export class EmailChangeService {
  constructor(
    @InjectRepository(EmailChangeRequestEntity)
    private readonly requestRepository: Repository<EmailChangeRequestEntity>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  private fail(field: string, error: string): never {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { [field]: error },
    });
  }

  private normalize(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Reject an address that is the current one, or already another account's. */
  private async assertUsable(user: User, newEmail: string): Promise<void> {
    if (this.normalize(user.email ?? '') === newEmail) {
      this.fail('email', 'emailUnchanged');
    }

    const existing = await this.usersService.findByEmail(newEmail);
    if (existing && Number(existing.id) !== Number(user.id)) {
      this.fail('email', 'emailAlreadyExists');
    }
  }

  /**
   * Start a change: mail a code to the NEW address. Asking again replaces the
   * previous code, after a short cooldown so the endpoint cannot be used to spam
   * someone else's inbox.
   */
  async requestChange(userId: User['id'], rawEmail: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) this.fail('user', 'notFound');

    const newEmail = this.normalize(rawEmail);
    await this.assertUsable(user, newEmail);

    const pending = await this.requestRepository.findOne({
      where: { userId: Number(userId) },
    });
    if (
      pending &&
      Date.now() - new Date(pending.createdAt).getTime() < RESEND_COOLDOWN_MS
    ) {
      this.fail('code', 'codeRecentlySent');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    if (pending) {
      await this.requestRepository.delete({ userId: Number(userId) });
    }
    await this.requestRepository.save(
      this.requestRepository.create({
        userId: Number(userId),
        newEmail,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        attempts: 0,
      }),
    );

    // To the NEW address: receiving it is the proof of ownership.
    await this.mailService.sendOtp({ to: newEmail, data: { otp: code } });
  }

  /**
   * Finish a change: verify the code, then move the account to the new address.
   * Returns the updated user.
   */
  async confirmChange(
    userId: User['id'],
    rawEmail: string,
    code: string,
  ): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) this.fail('user', 'notFound');

    const newEmail = this.normalize(rawEmail);
    const pending = await this.requestRepository.findOne({
      where: { userId: Number(userId) },
    });

    if (!pending) this.fail('code', 'codeNotFound');
    // The code is bound to the address it was sent to, so a code mailed to one
    // address cannot be redeemed against another.
    if (pending.newEmail !== newEmail) this.fail('email', 'emailMismatch');

    if (new Date() > new Date(pending.expiresAt)) {
      await this.requestRepository.delete({ userId: Number(userId) });
      this.fail('code', 'codeExpired');
    }

    if (pending.attempts >= CODE_MAX_ATTEMPTS) {
      await this.requestRepository.delete({ userId: Number(userId) });
      this.fail('code', 'codeMaxAttemptsExceeded');
    }

    if (!(await bcrypt.compare(code, pending.codeHash))) {
      await this.requestRepository.increment({ id: pending.id }, 'attempts', 1);
      this.fail('code', 'codeInvalid');
    }

    // Re-check: someone else may have registered the address while this request
    // was pending.
    await this.assertUsable(user, newEmail);

    const updated = await this.usersService.update(userId, {
      email: newEmail,
    });
    await this.requestRepository.delete({ userId: Number(userId) });

    if (!updated) this.fail('user', 'notFound');
    return updated;
  }

  /** The address a pending request is waiting on, for showing progress in the UI. */
  async pendingEmail(userId: User['id']): Promise<string | null> {
    const pending = await this.requestRepository.findOne({
      where: { userId: Number(userId) },
    });
    if (!pending) return null;
    if (new Date() > new Date(pending.expiresAt)) return null;
    return pending.newEmail;
  }
}
