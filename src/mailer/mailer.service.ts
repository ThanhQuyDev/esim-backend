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
     * Optional channel selector. Passing `'otp'` routes the message through
     * the dedicated OTP transport (when configured) and uses the OTP-specific
     * default From identity. Defaults to the primary transport.
     */
    transportName?: 'default' | 'otp';
  }): Promise<void> {
    let html: string | undefined = mailOptions.html;
    if (templatePath) {
      const template = await fs.readFile(templatePath, 'utf-8');
      html = Handlebars.compile(template, { strict: true })(context);
    }

    const useOtp = transportName === 'otp' && this.otpTransporter;
    const transporter = useOtp ? this.otpTransporter! : this.transporter;

    const defaultName = useOtp
      ? (this.configService.get('mail.otp.defaultName', { infer: true }) ??
        this.configService.get('mail.defaultName', { infer: true }))
      : this.configService.get('mail.defaultName', { infer: true });
    const defaultEmail = useOtp
      ? (this.configService.get('mail.otp.defaultEmail', { infer: true }) ??
        this.configService.get('mail.defaultEmail', { infer: true }))
      : this.configService.get('mail.defaultEmail', { infer: true });

    await transporter.sendMail({
      ...mailOptions,
      from: mailOptions.from
        ? mailOptions.from
        : `"${defaultName}" <${defaultEmail}>`,
      html: mailOptions.html ? mailOptions.html : html,
    });
  }
}
