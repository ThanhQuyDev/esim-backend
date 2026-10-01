import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { EmailTemplateRepository } from './infrastructure/persistence/email-template.repository';
import { EmailTemplate } from './domain/email-template';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { PreviewEmailTemplateResponseDto } from './dto/preview-email-template.dto';
import { NullableType } from '../utils/types/nullable.type';
import { AllConfigType } from '../config/config.type';

const SAMPLE_CONTEXT = {
  iccid: '8901234567890123456',
  activationCode: 'SAMPLE-ACTIVATION-CODE',
  lpa: 'LPA:1$smdp.example.com$SAMPLE-MATCHING-ID',
  smdpAddress: 'smdp.example.com',
  apn: 'internet',
  phoneNumber: '+84 912 345 678',
  planName: 'Vietnam 5GB 30 Days',
  orderNumber: 'ORD-260925210805694-NZ7UEC',
  qrCodeBase64:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  // Public usage lookup link (#003) — sample token so the CMS preview renders
  // the button instead of hiding it behind `{{#if usageCheckUrl}}`.
  usageCheckUrl: 'https://esim.vn/tra-cuu-esim?token=SAMPLE-LOOKUP-TOKEN',
  // Call / SMS allowance (#023). Non-zero so the preview shows those rows.
  callMinutes: 100,
  smsCount: 100,
  // Partner decision emails (approved / rejected).
  contactName: 'Nguyen Van A',
  reason: 'Kenh chua dap ung tieu chi cua chuong trinh.',
  logoUrl: '',
  app_name: '',
  subject: '',
};

@Injectable()
export class EmailTemplatesService {
  constructor(
    private readonly emailTemplateRepository: EmailTemplateRepository,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  findByName(name: string): Promise<NullableType<EmailTemplate>> {
    return this.emailTemplateRepository.findByName(name);
  }

  findAll(): Promise<EmailTemplate[]> {
    return this.emailTemplateRepository.findAll();
  }

  async getByName(name: string): Promise<EmailTemplate> {
    const existing = await this.emailTemplateRepository.findByName(name);
    if (!existing) throw new NotFoundException('Email template not found');
    return existing;
  }

  async updateByName(
    name: string,
    dto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    const existing = await this.emailTemplateRepository.findByName(name);
    if (!existing) throw new NotFoundException('Email template not found');
    return this.emailTemplateRepository.update(existing.id, dto);
  }

  async previewByName(
    name: string,
    overrides?: { htmlBody?: string; subject?: string },
  ): Promise<PreviewEmailTemplateResponseDto> {
    const existing = await this.emailTemplateRepository.findByName(name);
    if (!existing) throw new NotFoundException('Email template not found');

    const htmlBody = overrides?.htmlBody ?? existing.htmlBody;
    const subject = overrides?.subject ?? existing.subject;

    const context = {
      ...SAMPLE_CONTEXT,
      app_name: this.configService.get('app.name', { infer: true }) ?? 'eSIMVN',
      logoUrl: `${this.configService.get('app.backendDomain', { infer: true }) ?? ''}/files/logo_esimvn.svg`,
      subject,
    };

    return {
      subject: Handlebars.compile(subject, { strict: false })(context),
      html: Handlebars.compile(htmlBody, { strict: false })(context),
    };
  }
}
