import { ChatMessage, ChatMessageQuote } from '../../../../domain/chat-message';
import { ChatMessageEntity } from '../entities/chat-message.entity';

export class ChatMessageMapper {
  /** Only what the quote block renders — see ChatMessageQuote (#073). */
  static toQuote(entity: ChatMessageEntity): ChatMessageQuote {
    const quote = new ChatMessageQuote();
    quote.id = entity.id;
    quote.senderId = entity.senderId;
    quote.message = entity.message;
    quote.fileUrl = entity.fileUrl ?? null;
    quote.fileName = entity.fileName ?? null;
    quote.fileType = entity.fileType ?? null;
    return quote;
  }

  static toDomain(entity: ChatMessageEntity): ChatMessage {
    const domain = new ChatMessage();
    domain.id = entity.id;
    domain.chatRoomId = entity.chatRoomId;
    domain.senderId = entity.senderId;
    domain.message = entity.message;
    domain.fileUrl = entity.fileUrl ?? null;
    domain.fileName = entity.fileName ?? null;
    domain.fileType = entity.fileType ?? null;
    domain.fileSize = entity.fileSize ?? null;
    domain.replyToId = entity.replyToId ?? null;
    domain.replyTo = entity.replyTo
      ? ChatMessageMapper.toQuote(entity.replyTo)
      : null;
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
    entity.fileUrl = domain.fileUrl ?? null;
    entity.fileName = domain.fileName ?? null;
    entity.fileType = domain.fileType ?? null;
    entity.fileSize = domain.fileSize ?? null;
    entity.replyToId = domain.replyToId ?? null;
    entity.isRead = domain.isRead ?? false;
    return entity;
  }
}
