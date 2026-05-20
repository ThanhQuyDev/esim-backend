import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatAutomationEntity } from './entities/chat-automation.entity';
import { ChatAutomationRepository } from './repositories/chat-automation.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ChatAutomationEntity])],
  providers: [ChatAutomationRepository],
  exports: [ChatAutomationRepository],
})
export class RelationalChatAutomationPersistenceModule {}
