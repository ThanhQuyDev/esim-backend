import { UsersModule } from '../users/users.module';
import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { RelationalTicketPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketMessageEntity } from './infrastructure/persistence/relational/entities/ticket-message.entity';
import { MailModule } from '../mail/mail.module';
import { TicketInboundMailService } from './ticket-inbound-mail.service';

@Module({
  imports: [
    RelationalTicketPersistenceModule,
    UsersModule,
    // The acknowledgement and an admin's reply go out by email (#059).
    MailModule,
    // Replies live beside the ticket rather than in somebody's inbox (#032).
    TypeOrmModule.forFeature([TicketMessageEntity]),
  ],
  controllers: [TicketsController],
  // The inbound poller files customers' email replies onto their ticket (#059).
  // It is inert unless MAIL_INBOUND_HOST is configured.
  providers: [TicketsService, TicketInboundMailService],
  exports: [TicketsService],
})
export class TicketsModule {}
