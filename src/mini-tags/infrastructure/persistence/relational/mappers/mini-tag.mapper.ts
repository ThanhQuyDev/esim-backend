import { MiniTag } from '../../../../domain/mini-tag';
import { MiniTagEntity } from '../entities/mini-tag.entity';

export class MiniTagMapper {
  static toDomain(raw: MiniTagEntity): MiniTag {
    const domainEntity = new MiniTag();
    domainEntity.id = raw.id;
    domainEntity.image = raw.image;
    domainEntity.title = raw.title;
    domainEntity.description = raw.description;
    domainEntity.contentButton = raw.contentButton;
    domainEntity.linkUrl = raw.linkUrl;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: MiniTag): MiniTagEntity {
    const persistenceEntity = new MiniTagEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.image = domainEntity.image;
    persistenceEntity.title = domainEntity.title;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.contentButton = domainEntity.contentButton;
    persistenceEntity.linkUrl = domainEntity.linkUrl;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
