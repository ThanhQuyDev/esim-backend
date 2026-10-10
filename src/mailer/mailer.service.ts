import { Injectable } from '@nestjs/common';
import fs from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { AllConfigType } from '../config/config.type';
import nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly transporter: nodemailer.Transporter;
  /**
   * Infrastructure 2.5 — dedicated transport used for the OTP outbound flow.
   * Lazily set when `mail.otp.host` is configured. When the OTP block is left
   * empty the OTP transport falls back to the primary one so existing
   * deployments keep working unchanged.
   */
  private readonly otpTransporter: nodemailer.Transporter | null;
  /**
   * #062 — the support mailbox's own transport.
   *
   * Support mail has to be sent AS `support@esim.com.vn`, not merely with it in
   * Reply-To: that is the mailbox the poller reads, and most SMTP servers refuse a
   * From that does not match the authenticated account. Lazily set when
   * `mail.support.host` is configured; otherwise support mail keeps going out on
   * whichever transport it used before.
   */
  private readonly supportTransporter: nodemailer.Transporter | null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.transporter = nodemailer.createTransport({
      host: configService.get('mail.host', { infer: true }),
      port: configService.get('mail.port', { infer: true }),
      ignoreTLS: configService.get('mail.ignoreTLS', { infer: true }),
      secure: configService.get('mail.secure', { infer: true }),
      requireTLS: configService.get('mail.requireTLS', { infer: true }),
      auth: {
        user: configService.get('mail.user', { infer: true }),
        pass: configService.get('mail.password', { infer: true }),
      },
    });

    const otpHost = configService.get('mail.otp.host', { infer: true });
    this.otpTransporter = otpHost
      ? nodemailer.createTransport({
          host: otpHost,
          port: configService.get('mail.otp.port', { infer: true }),
          ignoreTLS: configService.get('mail.otp.ignoreTLS', { infer: true }),
          secure: configService.get('mail.otp.secure', { infer: true }),
          requireTLS: configService.get('mail.otp.requireTLS', { infer: true }),
          auth: {
            user: configService.get('mail.otp.user', { infer: true }),
            pass: configService.get('mail.otp.password', { infer: true }),
          },
        })
      : null;

    const supportHost = configService.get('mail.support.host', { infer: true });
    this.supportTransporter = supportHost
      ? nodemailer.createTransport({
          host: supportHost,
          port: configService.get('mail.support.port', { infer: true }),
          secure: configService.get('mail.support.secure', { infer: true }),
          auth: {
            user: configService.get('mail.support.user', { infer: true }),
            pass: configService.get('mail.support.password', { infer: true }),
          },
        })
      : null;
  }

  async sendMail({
    templatePath,
    context,
    transportName,
    ...mailOptions
  }: {
    templatePath: string;
    context: Record<string, unknown>;
    to: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    from?: string;
    /**
     * Where a reply should go, when that differs from the sending identity — a
     * support email has to land in the support mailbox, not in the transactional
     * sender's (#059). Passed straight to nodemailer, which has always supported
     * it; only this type was in the way.
     */
    replyTo?: string;
    /**
     * Files to attach, passed straight to nodemailer. Added for the monthly
     * partner reconciliation statement, which has to carry an .xlsx (#006).
     */
    attachments?: {
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }[];
    /**
     * Optional channel selector. `'otp'` routes through the dedicated OTP
     * transport and `'support'` through the support mailbox's own (#062), each
     * with its own default From identity. An unconfigured channel falls back to
     * the primary transport.
     */
    transportName?: 'default' | 'otp' | 'support';
    /**
     * Threading headers, passed straight to nodemailer: a support ticket's
     * emails reference its first one so mail clients keep them in one
     * conversation (#041, test round 4).
     */
    messageId?: string;
    inReplyTo?: string;
    references?: string | string[];
  }): Promise<void> {
    let html: string | undefined = mailOptions.html;
    if (templatePath) {
      const template = await fs.readFile(templatePath, 'utf-8');
      html = Handlebars.compile(template, { strict: true })(context);
    }

    // A requested transport that is not configured falls back to the primary one,
    // so an environment without the extra credentials still sends.
    const useSupport = transportName === 'support' && this.supportTransporter;
    const useOtp =
      !useSupport && transportName === 'otp' && this.otpTransporter;

    const transporter = useSupport
      ? this.supportTransporter!
      : useOtp
        ? this.otpTransporter!
        : this.transporter;

    const fallbackName = this.configService.get('mail.defaultName', {
      infer: true,
    });
    const fallbackEmail = this.configService.get('mail.defaultEmail', {
      infer: true,
    });

    const defaultName = useSupport
      ? (this.configService.get('mail.support.defaultName', { infer: true }) ??
        fallbackName)
      : useOtp
        ? (this.configService.get('mail.otp.defaultName', { infer: true }) ??
          fallbackName)
        : fallbackName;
    const defaultEmail = useSupport
      ? (this.configService.get('mail.support.user', { infer: true }) ??
        fallbackEmail)
      : useOtp
        ? (this.configService.get('mail.otp.defaultEmail', { infer: true }) ??
          fallbackEmail)
        : fallbackEmail;

    await transporter.sendMail({
      ...mailOptions,
      from: mailOptions.from
        ? mailOptions.from
        : `"${defaultName}" <${defaultEmail}>`,
      html: mailOptions.html ? mailOptions.html : html,
    });
  }
}
