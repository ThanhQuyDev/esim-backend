import { Global, Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { SalesPasswordController } from './sales-password.controller';
import { SalesPasswordGuard } from './sales-password.guard';
import { SalesPasswordService } from './sales-password.service';

/** Global, so any controller can put `SalesPasswordGuard` on a route (#004). */
@Global()
@Module({
  imports: [MailModule],
  controllers: [SalesPasswordController],
  providers: [SalesPasswordService, SalesPasswordGuard],
  exports: [SalesPasswordService, SalesPasswordGuard],
})
export class SalesPasswordModule {}
