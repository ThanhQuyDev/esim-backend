import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailChangeRequestEntity } from './entities/email-change-request.entity';
import { EmailChangeService } from './email-change.service';
import { EmailChangeController } from './email-change.controller';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailChangeRequestEntity]),
    UsersModule,
    MailModule,
  ],
  controllers: [EmailChangeController],
  providers: [EmailChangeService],
  exports: [EmailChangeService],
})
export class EmailChangeModule {}
