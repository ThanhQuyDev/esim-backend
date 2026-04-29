import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { RelationalChatPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalChatPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule, JwtModule.register({})],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
