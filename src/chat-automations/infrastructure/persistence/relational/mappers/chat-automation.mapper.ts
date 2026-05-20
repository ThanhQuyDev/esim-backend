import { ChatAutomation } from '../../../../domain/chat-automation';
import { ChatAutomationEntity } from '../entities/chat-automation.entity';

export class ChatAutomationMapper {
  static toDomain(raw: ChatAutomationEntity): ChatAutomation {
    const domain = new ChatAutomation();
    domain.id = raw.id;
    domain.type = raw.type;
    domain.message = raw.message;
    domain.isActive = raw.isActive;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }

  static toPersistence(
    domain: Partial<ChatAutomation>,
  ): Partial<ChatAutomationEntity> {
    const entity: Partial<ChatAutomationEntity> = {};
    if (domain.id) entity.id = domain.id;
    if (domain.type !== undefined) entity.type = domain.type;
    if (domain.message !== undefined) entity.message = domain.message;
    if (domain.isActive !== undefined) entity.isActive = domain.isActive;
    return entity;
  }
}
