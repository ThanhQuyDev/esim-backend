import { UsersModule } from '../users/users.module';
import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { RelationalTicketPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketMessageEntity } from './infrastructure/persistence/relational/entities/ticket-message.entity';

@Module({
  imports: [
    RelationalTicketPersistenceModule,
    UsersModule,
    // Replies live beside the ticket rather than in somebody's inbox (#032).
    TypeOrmModule.forFeature([TicketMessageEntity]),
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
