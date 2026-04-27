import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from './interfaces/mail-data.interface';

import { MaybeType } from '../utils/types/maybe.type';
import { MailerService } from '../mailer/mailer.service';
import path from 'path';
import { AllConfigType } from '../config/config.type';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import Handlebars from 'handlebars';

export interface EsimPurchaseMailData {
  to: string;
  esimId: number;
  iccid: string;
  activationCode: string | null;
  lpa: string | null;
  smdpAddress: string | null;
  apn: string | null;
  phoneNumber: string | null;
  planName: string;
  orderNumber: string;
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
    const qrCodeUrl = `${backendDomain}/api/v1/esims/${data.esimId}/qrcode`;

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
      logoUrl: `${backendDomain}/files/logo_esimvn.svg`,
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
