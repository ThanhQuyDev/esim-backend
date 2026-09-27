import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from './interfaces/mail-data.interface';
import { BRAND_LOGO_URL, SUPPORT_EMAIL } from './mail-branding';

import { MaybeType } from '../utils/types/maybe.type';
import { MailerService } from '../mailer/mailer.service';
import path from 'path';
import { AllConfigType } from '../config/config.type';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import Handlebars from 'handlebars';

export interface EsimPurchaseMailData {
  to: string;
  esimId: number;
  qrAccessToken: string | null;
  iccid: string;
  activationCode: string | null;
  lpa: string | null;
  smdpAddress: string | null;
  apn: string | null;
  phoneNumber: string | null;
  planName: string;
  orderNumber: string;
}

export interface InvoiceIssuedMailData {
  to: string;
  orderNumber: string;
  companyName: string;
  taxCode: string;
  address: string;
  totalAmountVnd: number;
}

/**
 * Where an approved partner signs in (#004).
 *
 * This pointed at the storefront's profile page (`/ho-so?tab=affiliate`) — the
 * customer site, not the partner portal — so the one instruction the approval
 * email gives, sign in with the email and password you registered with, could
 * not be followed from the button next to it.
 */
export const PARTNER_SIGN_IN_PATH = '/auth/sign-in';

/**
 * Where a rejected applicant fills the form in again (#003). The rejection
 * email used to say "bạn có thể nộp lại hồ sơ" without saying where.
 */
export const PARTNER_REGISTER_PATH = '/register/partner';

/** Outcome of an affiliate application, either way (#095). */
export interface PartnerDecisionMailData {
  to: string;
  contactName: string;
  /** Only carried by the rejection, and only when an admin gave one. */
  reason?: string | null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly emailTemplatesService: EmailTemplatesService,
  ) {}

  async userSignUp(mailData: MailData<{ hash: string }>): Promise<void> {
    const i18n = I18nContext.current();
    let emailConfirmTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;

    if (i18n) {
      [emailConfirmTitle, text1, text2, text3] = await Promise.all([
        i18n.t('common.confirmEmail'),
        i18n.t('confirm-email.text1'),
        i18n.t('confirm-email.text2'),
        i18n.t('confirm-email.text3'),
      ]);
    }

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + '/confirm-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: emailConfirmTitle,
      text: `${url.toString()} ${emailConfirmTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'dist',
        'mail',
        'mail-templates',
        'activation.hbs',
      ),
      context: {
        title: emailConfirmTitle,
        url: url.toString(),
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get('app.name', { infer: true }),
        text1,
        text2,
        text3,
      },
    });
  }

  async forgotPassword(
    mailData: MailData<{ hash: string; tokenExpires: number }>,
  ): Promise<void> {
    const i18n = I18nContext.current();
    let resetPasswordTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;
    let text4: MaybeType<string>;

    if (i18n) {
      [resetPasswordTitle, text1, text2, text3, text4] = await Promise.all([
        i18n.t('common.resetPassword'),
        i18n.t('reset-password.text1'),
        i18n.t('reset-password.text2'),
        i18n.t('reset-password.text3'),
        i18n.t('reset-password.text4'),
      ]);
    }

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + '/password-change',
    );
    url.searchParams.set('hash', mailData.data.hash);
    url.searchParams.set('expires', mailData.data.tokenExpires.toString());

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: resetPasswordTitle,
      text: `${url.toString()} ${resetPasswordTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'dist',
        'mail',
        'mail-templates',
        'reset-password.hbs',
      ),
      context: {
        title: resetPasswordTitle,
        url: url.toString(),
        actionTitle: resetPasswordTitle,
        app_name: this.configService.get('app.name', {
          infer: true,
        }),
        text1,
        text2,
        text3,
        text4,
      },
    });
  }

  async sendOtp(mailData: MailData<{ otp: string }>): Promise<void> {
    const i18n = I18nContext.current();
    let otpTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;

    if (i18n) {
      [otpTitle, text1, text2, text3] = await Promise.all([
        i18n.t('otp.title'),
        i18n.t('otp.text1'),
        i18n.t('otp.text2'),
        i18n.t('otp.text3'),
      ]);
    }

    await this.mailerService.sendMail({
      // Infrastructure 2.5 — route OTP through the dedicated SMTP transport
      // (no-reply@esim.com.vn) when configured, fall back to the primary
      // transport otherwise.
      transportName: 'otp',
      to: mailData.to,
      subject: otpTitle,
      text: `${otpTitle}: ${mailData.data.otp}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'dist',
        'mail',
        'mail-templates',
        'otp.hbs',
      ),
      context: {
        title: otpTitle,
        otp: mailData.data.otp,
        app_name: this.configService.get('app.name', { infer: true }),
        logoUrl: BRAND_LOGO_URL,
        text1,
        text2,
        text3,
      },
    });
  }

  async sendEsimPurchase(data: EsimPurchaseMailData): Promise<void> {
    const template =
      await this.emailTemplatesService.findByName('esim_purchase');
    if (!template) {
      this.logger.warn(
        'Email template "esim_purchase" not found, skipping email',
      );
      return;
    }

    const appName = this.configService.get('app.name', { infer: true });
    const backendDomain = this.configService.get('app.backendDomain', {
      infer: true,
    });
    const qrCodeUrl =
      data.esimId && data.qrAccessToken
        ? `${backendDomain}/api/v1/esims/${data.esimId}/qrcode?token=${data.qrAccessToken}`
        : '';

    const context = {
      iccid: data.iccid,
      activationCode: data.activationCode ?? '',
      lpa: data.lpa ?? '',
      smdpAddress: data.smdpAddress ?? '',
      apn: data.apn ?? '',
      phoneNumber: data.phoneNumber ?? '',
      planName: data.planName,
      orderNumber: data.orderNumber,
      qrCodeBase64: qrCodeUrl,
      logoUrl: BRAND_LOGO_URL,
      app_name: appName,
      subject: template.subject,
    };

    const subjectCompiled = Handlebars.compile(template.subject)(context);
    const htmlCompiled = Handlebars.compile(template.htmlBody, {
      strict: false,
    })(context);

    await this.mailerService.sendMail({
      to: data.to,
      subject: subjectCompiled,
      text: `Your eSIM is ready — Order ${data.orderNumber}`,
      templatePath: '',
      context: {},
      html: htmlCompiled,
    });
  }

  /**
   * Send the invoice confirmation email to the customer's `invoiceEmail`
   * once the order is paid. The PDF e-invoice itself is delivered separately
   * by the accounting team — this email simply confirms the request was
   * received and the order was paid successfully.
   */
  async sendInvoiceIssued(data: InvoiceIssuedMailData): Promise<void> {
    const template =
      await this.emailTemplatesService.findByName('invoice_issued');
    if (!template) {
      this.logger.warn(
        'Email template "invoice_issued" not found, skipping invoice email',
      );
      return;
    }

    const appName = this.configService.get('app.name', { infer: true });
    const totalAmountFormatted = new Intl.NumberFormat('vi-VN').format(
      Math.round(data.totalAmountVnd),
    );

    const context = {
      orderNumber: data.orderNumber,
      companyName: data.companyName,
      taxCode: data.taxCode,
      address: data.address,
      totalAmountFormatted,
      app_name: appName,
      // The invoice email never got a logo or a support address of its own
      // (#079): the header could only render as plain text, and the footer
      // pointed at a mailbox nobody reads.
      logoUrl: BRAND_LOGO_URL,
      supportEmail: SUPPORT_EMAIL,
      subject: template.subject,
    };

    const subjectCompiled = Handlebars.compile(template.subject)(context);
    const htmlCompiled = Handlebars.compile(template.htmlBody, {
      strict: false,
    })(context);

    await this.mailerService.sendMail({
      // Route through the dedicated no-reply transport (no-reply@esim.com.vn),
      // same channel as the OTP flow. Falls back to the primary transport when
      // the OTP/no-reply block is not configured.
      transportName: 'otp',
      to: data.to,
      subject: subjectCompiled,
      text: `Invoice request received for order ${data.orderNumber}`,
      templatePath: '',
      context: {},
      html: htmlCompiled,
    });
  }

  /**
   * Tell an affiliate applicant what an admin decided (#095).
   *
   * Approval and rejection share everything but the template and the reason,
   * so they share one sender. Nothing here throws: an applicant is approved in
   * the database whether or not the mail server is reachable, and the caller
   * fires this without awaiting the result.
   */
  /**
   * Absolute URL of a partner-portal page.
   *
   * `getOrThrow` on the fallback on purpose: a missing domain would otherwise
   * mail out a link starting with the literal word "undefined", and the caller
   * already swallows a throw here without touching the decision itself.
   */
  private partnerPortalUrl(path: string): string {
    const domain =
      this.configService.get('app.partnerPortalDomain', { infer: true }) ??
      this.configService.getOrThrow('app.frontendDomain', { infer: true });

    return domain.replace(/\/+$/, '') + path;
  }

  private async sendPartnerDecision(
    templateName:
      | 'partner_application_approved'
      | 'partner_application_rejected',
    data: PartnerDecisionMailData,
  ): Promise<void> {
    const template = await this.emailTemplatesService.findByName(templateName);
    if (!template) {
      this.logger.warn(
        `Email template "${templateName}" not found, skipping partner decision email`,
      );
      return;
    }

    const appName = this.configService.get('app.name', { infer: true });
    const context = {
      contactName: data.contactName,
      reason: data.reason ?? null,
      // Both links live on the partner portal, not the storefront (#003, #004).
      portalUrl: this.partnerPortalUrl(PARTNER_SIGN_IN_PATH),
      registerUrl: this.partnerPortalUrl(PARTNER_REGISTER_PATH),
      app_name: appName,
      logoUrl: BRAND_LOGO_URL,
      supportEmail: SUPPORT_EMAIL,
      subject: template.subject,
    };

    const subjectCompiled = Handlebars.compile(template.subject)(context);
    const htmlCompiled = Handlebars.compile(template.htmlBody, {
      strict: false,
    })(context);

    await this.mailerService.sendMail({
      transportName: 'otp',
      to: data.to,
      subject: subjectCompiled,
      text: subjectCompiled,
      templatePath: '',
      context: {},
      html: htmlCompiled,
    });
  }

  /**
   * Code that releases a bank account change (#005).
   *
   * Uses the same stored-template mechanism as the decision emails so support
   * can reword it without a deploy, and repeats the account being changed to:
   * an unexpected code is only alarming if it says what it would do.
   */
  async sendPartnerBankChangeOtp(data: {
    to: string;
    contactName: string;
    otp: string;
    bankSummary: string;
    expiresInMinutes: number;
  }): Promise<void> {
    const template = await this.emailTemplatesService.findByName(
      'partner_bank_change_otp',
    );
    if (!template) {
      this.logger.warn(
        'Email template "partner_bank_change_otp" not found, skipping bank change code',
      );
      return;
    }

    const context = {
      contactName: data.contactName,
      otp: data.otp,
      bankSummary: data.bankSummary,
      expiresInMinutes: data.expiresInMinutes,
      app_name: this.configService.get('app.name', { infer: true }),
      logoUrl: BRAND_LOGO_URL,
      supportEmail: SUPPORT_EMAIL,
      subject: template.subject,
    };

    const subjectCompiled = Handlebars.compile(template.subject)(context);
    const htmlCompiled = Handlebars.compile(template.htmlBody, {
      strict: false,
    })(context);

    await this.mailerService.sendMail({
      transportName: 'otp',
      to: data.to,
      subject: subjectCompiled,
      text: `${subjectCompiled}: ${data.otp}`,
      templatePath: '',
      context: {},
      html: htmlCompiled,
    });
  }

  async sendPartnerApproved(data: PartnerDecisionMailData): Promise<void> {
    await this.sendPartnerDecision('partner_application_approved', data);
  }

  async sendPartnerRejected(data: PartnerDecisionMailData): Promise<void> {
    await this.sendPartnerDecision('partner_application_rejected', data);
  }

  async confirmNewEmail(mailData: MailData<{ hash: string }>): Promise<void> {
    const i18n = I18nContext.current();
    let emailConfirmTitle: MaybeType<string>;
    let text1: MaybeType<string>;
    let text2: MaybeType<string>;
    let text3: MaybeType<string>;

    if (i18n) {
      [emailConfirmTitle, text1, text2, text3] = await Promise.all([
        i18n.t('common.confirmEmail'),
        i18n.t('confirm-new-email.text1'),
        i18n.t('confirm-new-email.text2'),
        i18n.t('confirm-new-email.text3'),
      ]);
    }

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + '/confirm-new-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: emailConfirmTitle,
      text: `${url.toString()} ${emailConfirmTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'dist',
        'mail',
        'mail-templates',
        'confirm-new-email.hbs',
      ),
      context: {
        title: emailConfirmTitle,
        url: url.toString(),
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get('app.name', { infer: true }),
        text1,
        text2,
        text3,
      },
    });
  }
}
