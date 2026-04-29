import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoomEntity } from './entities/chat-room.entity';
import { ChatMessageEntity } from './entities/chat-message.entity';
import { ChatRoomRepository } from '../chat-room.repository';
import { ChatMessageRepository } from '../chat-message.repository';
import { ChatRoomRelationalRepository } from './repositories/chat-room.repository';
import { ChatMessageRelationalRepository } from './repositories/chat-message.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ChatRoomEntity, ChatMessageEntity])],
  providers: [
    { provide: ChatRoomRepository, useClass: ChatRoomRelationalRepository },
    {
      provide: ChatMessageRepository,
      useClass: ChatMessageRelationalRepository,
    },
  ],
  exports: [ChatRoomRepository, ChatMessageRepository],
})
export class RelationalChatPersistenceModule {}
