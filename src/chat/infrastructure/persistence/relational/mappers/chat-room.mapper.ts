import { ChatRoom } from '../../../../domain/chat-room';
import { ChatRoomEntity } from '../entities/chat-room.entity';

export class ChatRoomMapper {
  static toDomain(entity: ChatRoomEntity): ChatRoom {
    const domain = new ChatRoom();
    domain.id = entity.id;
    domain.userId = entity.userId;
    domain.createdAt = entity.createdAt;
    domain.updatedAt = entity.updatedAt;
    return domain;
  }

  static toPersistence(domain: ChatRoom): ChatRoomEntity {
    const entity = new ChatRoomEntity();
    if (domain.id) entity.id = domain.id;
    entity.userId = domain.userId;
    return entity;
  }
}
