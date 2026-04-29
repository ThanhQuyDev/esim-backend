import { ChatMessage } from '../../../../domain/chat-message';
import { ChatMessageEntity } from '../entities/chat-message.entity';

export class ChatMessageMapper {
  static toDomain(entity: ChatMessageEntity): ChatMessage {
    const domain = new ChatMessage();
    domain.id = entity.id;
    domain.chatRoomId = entity.chatRoomId;
    domain.senderId = entity.senderId;
    domain.message = entity.message;
    domain.isRead = entity.isRead;
    domain.createdAt = entity.createdAt;
    domain.updatedAt = entity.updatedAt;
    return domain;
  }

  static toPersistence(domain: ChatMessage): ChatMessageEntity {
    const entity = new ChatMessageEntity();
    if (domain.id) entity.id = domain.id;
    entity.chatRoomId = domain.chatRoomId;
    entity.senderId = domain.senderId;
    entity.message = domain.message;
    entity.isRead = domain.isRead ?? false;
    return entity;
  }
}
