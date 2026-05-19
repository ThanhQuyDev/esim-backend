import { ChatRoom } from '../../../../domain/chat-room';
import { ChatRoomEntity } from '../entities/chat-room.entity';

export class ChatRoomMapper {
  static toDomain(entity: ChatRoomEntity): ChatRoom {
    const domain = new ChatRoom();
    domain.id = entity.id;
    domain.userId = entity.userId;
    domain.createdAt = entity.createdAt;
    domain.updatedAt = entity.updatedAt;
    // Feature 5.1 — when the relation has been joined (admin chat list with
    // email filter), expose a compact user summary on the domain object.
    if (entity.user) {
      domain.user = {
        id: entity.user.id,
        email: entity.user.email ?? null,
        firstName: entity.user.firstName ?? null,
        lastName: entity.user.lastName ?? null,
      };
    } else {
      domain.user = null;
    }
    return domain;
  }

  static toPersistence(domain: ChatRoom): ChatRoomEntity {
    const entity = new ChatRoomEntity();
    if (domain.id) entity.id = domain.id;
    entity.userId = domain.userId;
    return entity;
  }
}
