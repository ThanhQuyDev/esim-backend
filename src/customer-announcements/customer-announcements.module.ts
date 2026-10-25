import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { CustomerAnnouncementsController } from './customer-announcements.controller';
import { CustomerAnnouncementsService } from './customer-announcements.service';

/** Email announcements to storefront customers (vande #072). */
@Module({
  imports: [MailModule],
  controllers: [CustomerAnnouncementsController],
  providers: [CustomerAnnouncementsService],
})
export class CustomerAnnouncementsModule {}
