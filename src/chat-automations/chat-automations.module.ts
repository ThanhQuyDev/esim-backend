import { Module } from '@nestjs/common';
import { ChatAutomationsService } from './chat-automations.service';
import { AdminChatAutomationsController } from './chat-automations.controller';
import { RelationalChatAutomationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalChatAutomationPersistenceModule],
  controllers: [AdminChatAutomationsController],
  providers: [ChatAutomationsService],
  exports: [ChatAutomationsService],
})
export class ChatAutomationsModule {}
