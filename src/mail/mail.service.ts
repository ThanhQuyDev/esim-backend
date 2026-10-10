import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from './interfaces/mail-data.interface';
import {
  BRAND_LOGO_URL,
  BRAND_NAME,
  SITE_URL,
  SUPPORT_EMAIL,
} from './mail-branding';

import { MaybeType } from '../utils/types/maybe.type';
import { MailerService } from '../mailer/mailer.service';
import path from 'path';
import { AllConfigType } from '../config/config.type';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import Handlebars from 'handlebars';
import { createEsimLookupToken } from '../esims/esim-lookup-token';

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
  /**
   * Call minutes / SMS the plan includes (#023). A customer who bought a
   * call-and-SMS eSIM was never told so anywhere — not in this email, not in
   * their profile. 0 or null means data-only and the rows are left out.
   */
  callMinutes?: number | null;
  smsCount?: number | null;
  /**
   * The plan's data and length, for the "Dữ liệu / Data" line (#025, test
   * round 4): "2GB / ngày", "1GB - 7 ngày", "Không giới hạn".
   */
  planData?: {
    dataMb?: number | null;
    durationDays?: number | null;
    type?: string | null;
  } | null;
}

/** Plan name as the CMS shows it: "United States 2GB / 15day - 20Mins - 20SMS". */
export function emailPlanName(
  name: string,
  call?: number | null,
  sms?: number | null,
): string {
  const base = (name ?? '').trim();
  if (!base) return '';
  const parts = [base];
  if (Number(call) > 0 && !/\bmins?\b|phút/i.test(base))
    parts.push(`${Number(call)}Mins`);
  if (Number(sms) > 0 && !/\bsms\b/i.test(base))
    parts.push(`${Number(sms)}SMS`);
  return parts.join(' - ');
}

/** "2GB / ngày" for a per-day plan, "1GB - 7 ngày" for a fixed one, "Không giới hạn". */
export function emailDataText(plan: EsimPurchaseMailData['planData']): string {
  if (!plan) return '';
  const mb = Number(plan.dataMb) || 0;
  if (mb <= 0) return 'Không giới hạn';
  const size =
    mb >= 1024 ? `${parseFloat((mb / 1024).toFixed(1))}GB` : `${mb}MB`;
  if (plan.type && plan.type !== 'fixed') return `${size} / ngày`;
  const days = Number(plan.durationDays) || 0;
  return days > 0 ? `${size} - ${days} ngày` : size;
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
/** The partner portal's "Hỗ trợ" page, where a partner opens a new request (#042). */
export const PARTNER_SUPPORT_PATH = '/dashboard/portal/support';

/**
 * Public eSIM lookup page on the storefront (#003), Vietnamese slug because `vi`
 * is the default locale and carries no prefix. Kept next to the other email
 * paths so a rename shows up here rather than inside a template string.
 */
export const ESIM_LOOKUP_PATH = '/tra-cuu-esim';

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

/** Credentials for an account an admin created by hand (#059). */
export interface PartnerAccountCreatedMailData {
  to: string;
  contactName: string;
  email: string;
  temporaryPassword: string;
}

/**
 * A support-ticket email (#059).
 *
 * `ticketDescription` is what the customer wrote (acknowledgement); `replyBody`
 * is what an admin wrote (reply). One of the two is set, depending on which mail
 * is going out.
 */
export interface TicketMailData {
  to: string;
  ticketNumber: string;
  ticketSubject: string;
  ticketDescription?: string | null;
  replyBody?: string | null;
  /** The ticket belongs to a partner — links go to the portal (#042). */
  isPartner?: boolean;
}

/** The Message-ID of a ticket's first email, which every later one points to. */
export function ticketThreadId(ticketNumber: string): string {
  const domain = SUPPORT_EMAIL.split('@')[1] ?? 'esim.com.vn';
  return `<ticket-${ticketNumber.toLowerCase()}@${domain}>`;
}

/**
 * Subject of a follow-up in a ticket's email thread: "Re: " + the
 * acknowledgement's subject. Mail clients group by subject as well as by
 * References, so a follow-up with its own subject opened a new conversation
 * ("[HT-000005] Phản hồi yêu cầu hỗ trợ: …" each time) — #041, test round 4.
 */
export function ticketThreadSubject(ackSubject: string): string {
  const base = ackSubject.trim().replace(/^(re:\s*)+/i, '');
  return `Re: ${base}`;
}

/** An announcement going out by email (#079). */
export interface PartnerNotificationMailData {
  to: string;
  contactName: string;
  title: string;
  body: string;
}

/** One partner's monthly statement, as the email shows it (#076). */
export interface PartnerReconciliationMailData {
  to: string;
  contactName: string;
  /** "Tháng 09/2026" — already worded, so the template does no arithmetic. */
  periodLabel: string;
  validOrders: number;
  esimsSold: number;
  viaCouponPercent: number;
  revenueVnd: number;
  commissionVnd: number;
  /**
   * Biên bản đối soát .xlsx (#006). Thiếu nó thì email vẫn gửi với 5 chỉ số như
   * trước — mất file đính kèm còn hơn mất cả thông báo đối soát của cả tháng.
   */
  attachment?: { filename: string; content: Buffer };
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly emailTemplatesService: EmailTemplatesService,
  ) {}

  /**
   * A link into the storefront. `FRONTEND_DOMAIN` may end in "/", which used
   * to give "…app//password-change" (#012).
   */
  private frontendUrl(pathname: string): URL {
    const base = this.configService
      .getOrThrow('app.frontendDomain', { infer: true })
      .replace(/\/+$/, '');
    return new URL(base + pathname);
  }

  /**
   * Account emails (confirm sign-up, reset password, confirm a new address)
   * in Vietnamese AND English (#012, test round 4) — an English-only reset
   * email read as spam to Vietnamese customers. Sent from no-reply@, the
   * system address; order@ is for eSIM deliveries only.
   */
  private async sendAuthActionMail(params: {
    to: string;
    url: string;
    subject: string;
    titleVi: string;
    titleEn: string;
    linesVi: string[];
    linesEn: string[];
    actionTitle: string;
    noteVi: string;
    noteEn: string;
  }): Promise<void> {
    await this.mailerService.sendMail({
      transportName: 'otp',
      to: params.to,
      subject: params.subject,
      text: [
        params.titleVi,
        ...params.linesVi,
        params.url,
        '',
        params.titleEn,
        ...params.linesEn,
        params.url,
      ].join('\n'),
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'dist',
        'mail',
        'mail-templates',
        'auth-action.hbs',
      ),
      context: {
        title: params.subject,
        url: params.url,
        actionTitle: params.actionTitle,
        titleVi: params.titleVi,
        titleEn: params.titleEn,
        linesVi: params.linesVi,
        linesEn: params.linesEn,
        noteVi: params.noteVi,
        noteEn: params.noteEn,
        app_name: BRAND_NAME,
        logoUrl: BRAND_LOGO_URL,
        siteUrl: SITE_URL,
      },
    });
  }

  async userSignUp(mailData: MailData<{ hash: string }>): Promise<void> {
    const url = this.frontendUrl('/confirm-email');
    url.searchParams.set('hash', mailData.data.hash);

    await this.sendAuthActionMail({
      to: mailData.to,
      url: url.toString(),
      subject: `Xác nhận email / Confirm your email — ${BRAND_NAME}`,
      titleVi: 'Xác nhận địa chỉ email',
      titleEn: 'Confirm your email address',
      linesVi: [
        'Chào bạn,',
        `Bạn sắp hoàn tất đăng ký tài khoản ${BRAND_NAME}. Bấm nút bên dưới để xác nhận địa chỉ email này.`,
      ],
      linesEn: [
        'Hi there,',
        `You are almost ready to start using ${BRAND_NAME}. Press the button above to verify your email address.`,
      ],
      actionTitle: 'Xác nhận email / Confirm email',
      noteVi: 'Nếu bạn không đăng ký tài khoản, vui lòng bỏ qua email này.',
      noteEn: 'If you did not sign up, please ignore this email.',
    });
  }

  async forgotPassword(
    mailData: MailData<{ hash: string; tokenExpires: number }>,
  ): Promise<void> {
    const url = this.frontendUrl('/password-change');
    url.searchParams.set('hash', mailData.data.hash);
    url.searchParams.set('expires', mailData.data.tokenExpires.toString());

    await this.sendAuthActionMail({
      to: mailData.to,
      url: url.toString(),
      subject: `Đặt lại mật khẩu / Reset your password — ${BRAND_NAME}`,
      titleVi: 'Đặt lại mật khẩu',
      titleEn: 'Reset your password',
      linesVi: [
        'Bạn gặp khó khăn khi đăng nhập?',
        'Đặt lại mật khẩu rất đơn giản: bấm nút bên dưới và làm theo hướng dẫn.',
      ],
      linesEn: [
        'Trouble signing in?',
        'Resetting your password is easy: press the button above and follow the instructions.',
      ],
      actionTitle: 'Đặt lại mật khẩu / Reset password',
      noteVi:
        'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.',
      noteEn:
        'If you did not ask to reset your password, please ignore this email — your password stays as it is.',
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
        app_name: BRAND_NAME,
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

    const appName = BRAND_NAME;
    const backendDomain = this.configService.get('app.backendDomain', {
      infer: true,
    });
    const frontendDomain = this.configService.get('app.frontendDomain', {
      infer: true,
    });
    const qrCodeUrl =
      data.esimId && data.qrAccessToken
        ? `${backendDomain}/api/v1/esims/${data.esimId}/qrcode?token=${data.qrAccessToken}`
        : '';

    // Self-service usage page (#003). The token stands in for the ICCID so the
    // customer can forward this link to whoever is travelling with the eSIM
    // without handing them enough to order a topup on it.
    //
    // Signing needs a secret, and a deployment missing one must NOT cost the
    // customer their eSIM: the link is a convenience, the email is the delivery.
    // Without it the template's `{{#if usageCheckUrl}}` simply hides the button.
    let usageCheckUrl = '';
    if (data.esimId && frontendDomain) {
      try {
        usageCheckUrl = `${frontendDomain}${ESIM_LOOKUP_PATH}?token=${createEsimLookupToken(data.esimId)}`;
      } catch (err) {
        this.logger.error(
          `sendEsimPurchase: could not build the usage lookup link: ${(err as Error).message}`,
        );
      }
    }

    const context = {
      iccid: data.iccid,
      activationCode: data.activationCode ?? '',
      lpa: data.lpa ?? '',
      smdpAddress: data.smdpAddress ?? '',
      apn: data.apn ?? '',
      phoneNumber: data.phoneNumber ?? '',
      // Named like the CMS names it, minutes / SMS spelled out (#025).
      planName: emailPlanName(data.planName, data.callMinutes, data.smsCount),
      dataText: emailDataText(data.planData),
      orderNumber: data.orderNumber,
      // Empty string rather than 0, so `{{#if}}` in the template treats a
      // data-only plan as "no allowance" instead of printing "0 phút".
      callMinutes: Number(data.callMinutes) > 0 ? Number(data.callMinutes) : '',
      smsCount: Number(data.smsCount) > 0 ? Number(data.smsCount) : '',
      qrCodeBase64: qrCodeUrl,
      usageCheckUrl,
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

    const appName = BRAND_NAME;
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

    const appName = BRAND_NAME;
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
      app_name: BRAND_NAME,
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

  /**
   * Tell a partner an admin made them an account, and how to get in (#059).
   *
   * The only place they learn their login, since they never filled in a form —
   * so if the template is missing this is worth shouting about rather than
   * skipping quietly.
   */
  async sendPartnerAccountCreated(
    data: PartnerAccountCreatedMailData,
  ): Promise<void> {
    const template = await this.emailTemplatesService.findByName(
      'partner_account_created',
    );
    if (!template) {
      this.logger.error(
        'Email template "partner_account_created" not found — the partner was not told their password',
      );
      return;
    }

    const appName = BRAND_NAME;
    const context = {
      contactName: data.contactName,
      email: data.email,
      temporaryPassword: data.temporaryPassword,
      portalUrl: this.partnerPortalUrl(PARTNER_SIGN_IN_PATH),
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
   * An announcement, sent as an email as well as to the bell (#079).
   *
   * The admin's own words are the content; the template only frames them.
   * Handlebars escapes the body, so an announcement mentioning "<24h" arrives
   * as written rather than as broken markup.
   */
  async sendPartnerNotification(
    data: PartnerNotificationMailData,
  ): Promise<void> {
    const template = await this.emailTemplatesService.findByName(
      'partner_notification',
    );
    if (!template) {
      this.logger.error(
        'Email template "partner_notification" not found — the announcement was not emailed',
      );
      return;
    }

    const appName = BRAND_NAME;
    const context = {
      contactName: data.contactName,
      title: data.title,
      body: data.body,
      portalUrl: this.partnerPortalUrl(PARTNER_SIGN_IN_PATH),
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
      text: `${data.title}

${data.body}`,
      templatePath: '',
      context: {},
      html: htmlCompiled,
    });
  }

  /**
   * A support email: the acknowledgement of a new ticket, or an admin's reply
   * (#059).
   *
   * Both carry the ticket number in the subject, which is the shared reference
   * between the email thread and the CMS thread — and what a reply has to be
   * matched back to. `replyTo` is the support mailbox rather than the sending
   * address, so a customer pressing Reply reaches somewhere that is read.
   */
  private async sendTicketEmail(
    templateName:
      | 'ticket_acknowledgement'
      | 'ticket_admin_reply'
      | 'ticket_resolved_closed'
      | 'ticket_closed_reply',
    data: TicketMailData,
  ): Promise<void> {
    const template = await this.emailTemplatesService.findByName(templateName);
    if (!template) {
      this.logger.error(
        `Email template "${templateName}" not found — ticket ${data.ticketNumber} was not emailed`,
      );
      return;
    }

    const appName = BRAND_NAME;

    // The mailbox the poller actually reads, so Reply can never land somewhere
    // nobody looks (#062). Falls back to the brand constant when inbound mail is
    // not configured — the address shown is then still a real mailbox.
    const inboundUser = this.configService.get('mail.inbound.user', {
      infer: true,
    });
    const supportEmail = inboundUser || SUPPORT_EMAIL;

    const context = {
      ticketNumber: data.ticketNumber,
      ticketSubject: data.ticketSubject,
      ticketDescription: data.ticketDescription ?? '',
      replyBody: data.replyBody ?? '',
      app_name: appName,
      logoUrl: BRAND_LOGO_URL,
      supportEmail,
      subject: template.subject,
      // Where a new request is opened — linked from the "ticket is closed" reply.
      supportFormUrl: data.isPartner
        ? this.partnerPortalUrl(PARTNER_SUPPORT_PATH)
        : `${SITE_URL}/help-center/support`,
    };

    const ownSubject = Handlebars.compile(template.subject)(context);

    // One email thread per ticket (#041, test round 4): the acknowledgement
    // carries the ticket's thread id, and every later email replies to it under
    // the same subject, so the customer sees the whole exchange together.
    const isFirst = templateName === 'ticket_acknowledgement';
    const threadId = ticketThreadId(data.ticketNumber);
    let subjectCompiled = ownSubject;
    if (!isFirst) {
      const ack = await this.emailTemplatesService.findByName(
        'ticket_acknowledgement',
      );
      subjectCompiled = ticketThreadSubject(
        ack ? Handlebars.compile(ack.subject)(context) : ownSubject,
      );
    }
    const threading = isFirst
      ? { messageId: threadId }
      : {
          messageId: `<ticket-${data.ticketNumber.toLowerCase()}-${Date.now()}@${threadId.split('@')[1]}`,
          inReplyTo: threadId,
          references: [threadId],
        };

    const htmlCompiled = Handlebars.compile(template.htmlBody, {
      strict: false,
    })({ ...context, subject: subjectCompiled });

    await this.mailerService.sendMail({
      ...threading,
      // Sent AS the support mailbox (#062), so the From a customer sees is the
      // one their reply reaches. Falls back to the primary transport when the
      // support SMTP credentials are not configured.
      transportName: 'support',
      to: data.to,
      replyTo: supportEmail,
      subject: subjectCompiled,
      // A plain-text part that still carries the reference, for clients that
      // never render the HTML.
      text: `[${data.ticketNumber}] ${data.ticketSubject}

${data.replyBody ?? data.ticketDescription ?? ''}`,
      templatePath: '',
      context: {},
      html: htmlCompiled,
    });
  }

  /** "Cảm ơn bạn đã liên hệ" — sent once, when the ticket is opened (#059). */
  async sendTicketAcknowledgement(data: TicketMailData): Promise<void> {
    await this.sendTicketEmail('ticket_acknowledgement', data);
  }

  /** An admin's reply, emailed to the customer (#059). */
  async sendTicketReply(data: TicketMailData): Promise<void> {
    await this.sendTicketEmail('ticket_admin_reply', data);
  }

  /**
   * The notice that a ticket was marked resolved and is now closing (#061).
   *
   * Replying to it reopens the ticket, which is why this template keeps the
   * "you can reply" footer rather than signing off for good.
   */
  async sendTicketResolved(data: TicketMailData): Promise<void> {
    await this.sendTicketEmail('ticket_resolved_closed', data);
  }

  /**
   * The automatic answer to a customer writing into a CLOSED ticket (#041,
   * test round 4): "this ticket is closed — open a new request here".
   */
  async sendTicketClosedReply(data: TicketMailData): Promise<void> {
    await this.sendTicketEmail('ticket_closed_reply', data);
  }

  /**
   * The monthly statement a partner gets by email (#076).
   *
   * Numbers arrive already formatted, because a partner reading "18.000.000đ"
   * and an admin reading the console must see the same thing and Handlebars is
   * the wrong place to be doing arithmetic.
   */
  async sendPartnerReconciliationStatement(
    data: PartnerReconciliationMailData,
  ): Promise<void> {
    const template = await this.emailTemplatesService.findByName(
      'partner_reconciliation_statement',
    );
    if (!template) {
      this.logger.error(
        'Email template "partner_reconciliation_statement" not found — no statement was sent',
      );
      return;
    }

    const vnd = (value: number) => value.toLocaleString('vi-VN');
    const appName = BRAND_NAME;
    const context = {
      contactName: data.contactName,
      periodLabel: data.periodLabel,
      validOrders: vnd(data.validOrders),
      esimsSold: vnd(data.esimsSold),
      viaCouponPercent: data.viaCouponPercent,
      revenueVnd: vnd(data.revenueVnd),
      commissionVnd: vnd(data.commissionVnd),
      portalUrl: this.partnerPortalUrl(PARTNER_SIGN_IN_PATH),
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
      ...(data.attachment
        ? {
            attachments: [
              {
                filename: data.attachment.filename,
                content: data.attachment.content,
                contentType:
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              },
            ],
          }
        : {}),
    });
  }

  async confirmNewEmail(mailData: MailData<{ hash: string }>): Promise<void> {
    const url = this.frontendUrl('/confirm-new-email');
    url.searchParams.set('hash', mailData.data.hash);

    await this.sendAuthActionMail({
      to: mailData.to,
      url: url.toString(),
      subject: `Xác nhận email mới / Confirm your new email — ${BRAND_NAME}`,
      titleVi: 'Xác nhận địa chỉ email mới',
      titleEn: 'Confirm your new email address',
      linesVi: [
        'Chào bạn,',
        `Bấm nút bên dưới để xác nhận đây là địa chỉ email mới của tài khoản ${BRAND_NAME}.`,
      ],
      linesEn: [
        'Hi there,',
        `Press the button above to confirm this as the new email of your ${BRAND_NAME} account.`,
      ],
      actionTitle: 'Xác nhận email / Confirm email',
      noteVi: 'Nếu bạn không yêu cầu đổi email, vui lòng bỏ qua email này.',
      noteEn:
        'If you did not ask to change your email, please ignore this email.',
    });
  }
}
