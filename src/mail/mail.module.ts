import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailerModule } from '../mailer/mailer.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';

@Module({
  imports: [ConfigModule, MailerModule, EmailTemplatesModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
