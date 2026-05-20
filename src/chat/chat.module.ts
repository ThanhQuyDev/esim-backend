import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminChatRoomsController } from './admin-chat-rooms.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { RelationalChatPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ChatAutomationsModule } from '../chat-automations/chat-automations.module';

const infrastructurePersistenceModule = RelationalChatPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    JwtModule.register({}),
    ChatAutomationsModule,
  ],
  controllers: [AdminChatRoomsController],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
