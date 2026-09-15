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

/** Which address the pending code was mailed to. */
export type EmailChangeStage = 'current' | 'new';
const STAGE_CURRENT: EmailChangeStage = 'current';
const STAGE_NEW: EmailChangeStage = 'new';

export interface PendingEmailChange {
  pendingEmail: string | null;
  stage: EmailChangeStage | null;
}

/**
 * Self-service email change (#057, #023).
 *
 * The customer is looked up by **id** the whole way through — that is what makes
 * changing the address safe, since nothing in the account hangs off the email
 * string itself.
 *
 * Two proofs, in order:
 * 1. the CURRENT address — so someone holding only a signed-in session (a shared
 *    or stolen device) cannot move the account away from its owner's inbox;
 * 2. the NEW address — login is email + OTP, so switching to a mistyped address
 *    would lock the customer out of their own eSIMs with no way back.
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

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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
   * Check a code against the pending request: expiry, attempt budget, then the
   * hash. A wrong code costs an attempt; an expired or exhausted request is
   * dropped so the customer has to start over.
   */
  private async checkCode(
    userId: User['id'],
    pending: EmailChangeRequestEntity,
    code: string,
  ): Promise<void> {
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
  }

  /**
   * Start a change: mail a code to the account's CURRENT address (#023). Asking
   * again restarts the change with a fresh code, after a short cooldown so the
   * endpoint cannot be used to spam an inbox.
   *
   * An account with no email on file (a social sign-in without one) has no
   * current address to prove, so it goes straight to the new-address step.
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

    const currentEmail = this.normalize(user.email ?? '');
    const stage = currentEmail ? STAGE_CURRENT : STAGE_NEW;
    const code = this.generateCode();

    if (pending) {
      await this.requestRepository.delete({ userId: Number(userId) });
    }
    await this.requestRepository.save(
      this.requestRepository.create({
        userId: Number(userId),
        newEmail,
        stage,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        attempts: 0,
      }),
    );

    await this.mailService.sendOtp({
      to: stage === STAGE_CURRENT ? currentEmail : newEmail,
      data: { otp: code },
    });
  }

  /**
   * Step 1 done: the code from the CURRENT address checks out, so mail a second,
   * independent code to the NEW address.
   */
  async verifyCurrentEmail(
    userId: User['id'],
    code: string,
  ): Promise<PendingEmailChange> {
    const user = await this.usersService.findById(userId);
    if (!user) this.fail('user', 'notFound');

    const pending = await this.requestRepository.findOne({
      where: { userId: Number(userId) },
    });
    if (!pending) this.fail('code', 'codeNotFound');
    if (pending.stage !== STAGE_CURRENT) {
      this.fail('code', 'currentEmailAlreadyVerified');
    }

    await this.checkCode(userId, pending, code);

    // Someone may have registered the new address meanwhile.
    await this.assertUsable(user, pending.newEmail);

    const nextCode = this.generateCode();
    await this.requestRepository.update(
      { id: pending.id },
      {
        stage: STAGE_NEW,
        codeHash: await bcrypt.hash(nextCode, 10),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        attempts: 0,
      },
    );

    // To the NEW address: receiving it is the proof of ownership.
    await this.mailService.sendOtp({
      to: pending.newEmail,
      data: { otp: nextCode },
    });

    return { pendingEmail: pending.newEmail, stage: STAGE_NEW };
  }

  /**
   * Step 2: verify the code from the NEW address, then move the account there.
   * Refused until the current address has been proved. Returns the updated user.
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
    // The code for the current address must never be able to finish the change.
    if (pending.stage !== STAGE_NEW) {
      this.fail('code', 'currentEmailNotVerified');
    }

    await this.checkCode(userId, pending, code);

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

  /** The pending change and which step it is on, for showing progress in the UI. */
  async pendingChange(userId: User['id']): Promise<PendingEmailChange> {
    const pending = await this.requestRepository.findOne({
      where: { userId: Number(userId) },
    });
    if (!pending || new Date() > new Date(pending.expiresAt)) {
      return { pendingEmail: null, stage: null };
    }
    return {
      pendingEmail: pending.newEmail,
      stage: pending.stage === STAGE_CURRENT ? STAGE_CURRENT : STAGE_NEW,
    };
  }
}
