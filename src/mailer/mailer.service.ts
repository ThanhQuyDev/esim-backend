import { Injectable } from '@nestjs/common';
import fs from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { AllConfigType } from '../config/config.type';
import { Resend } from 'resend';

// --- SMTP (nodemailer) — dùng khi host hỗ trợ outbound SMTP (port 587/465) ---
// import nodemailer from 'nodemailer';
//
// @Injectable()
// export class MailerService {
//   private readonly transporter: nodemailer.Transporter;
//   constructor(private readonly configService: ConfigService<AllConfigType>) {
//     this.transporter = nodemailer.createTransport({
//       host: configService.get('mail.host', { infer: true }),
//       port: configService.get('mail.port', { infer: true }),
//       ignoreTLS: configService.get('mail.ignoreTLS', { infer: true }),
//       secure: configService.get('mail.secure', { infer: true }),
//       requireTLS: configService.get('mail.requireTLS', { infer: true }),
//       auth: {
//         user: configService.get('mail.user', { infer: true }),
//         pass: configService.get('mail.password', { infer: true }),
//       },
//     });
//   }
//
//   async sendMail({ templatePath, context, ...mailOptions }): Promise<void> {
//     let html: string | undefined;
//     if (templatePath) {
//       const template = await fs.readFile(templatePath, 'utf-8');
//       html = Handlebars.compile(template, { strict: true })(context);
//     }
//     await this.transporter.sendMail({
//       ...mailOptions,
//       from: mailOptions.from
//         ? mailOptions.from
//         : `"${this.configService.get('mail.defaultName', { infer: true })}" <${this.configService.get('mail.defaultEmail', { infer: true })}>`,
//       html: mailOptions.html ? mailOptions.html : html,
//     });
//   }
// }
// --- END SMTP ---

@Injectable()
export class MailerService {
  private readonly resend: Resend;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.resend = new Resend(
      configService.get('mail.password', { infer: true }),
    );
  }

  async sendMail({
    templatePath,
    context,
    ...mailOptions
  }: {
    templatePath: string;
    context: Record<string, unknown>;
    to: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    from?: string;
  }): Promise<void> {
    let html: string | undefined = mailOptions.html;
    if (templatePath) {
      const template = await fs.readFile(templatePath, 'utf-8');
      html = Handlebars.compile(template, { strict: true })(context);
    }

    const from = mailOptions.from
      ? mailOptions.from
      : `${this.configService.get('mail.defaultName', { infer: true })} <${this.configService.get('mail.defaultEmail', { infer: true })}>`;

    await this.resend.emails.send({
      from,
      to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
      subject: mailOptions.subject ?? '',
      html,
      text: mailOptions.text,
    } as any);
  }
}
