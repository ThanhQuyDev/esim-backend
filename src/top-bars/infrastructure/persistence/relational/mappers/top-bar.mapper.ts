import { TopBar } from '../../../../domain/top-bar';

import { FileMapper } from '../../../../../files/infrastructure/persistence/relational/mappers/file.mapper';

import { TopBarEntity } from '../entities/top-bar.entity';

export class TopBarMapper {
  static toDomain(raw: TopBarEntity): TopBar {
    const domainEntity = new TopBar();
    domainEntity.url = raw.url;

    domainEntity.buttonContent = raw.buttonContent;

    domainEntity.title = raw.title;

    domainEntity.language = raw.language;

    if (raw.icon) {
      domainEntity.icon = FileMapper.toDomain(raw.icon);
    } else if (raw.icon === null) {
      domainEntity.icon = null;
    }

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: TopBar): TopBarEntity {
    const persistenceEntity = new TopBarEntity();
    persistenceEntity.url = domainEntity.url;

    persistenceEntity.buttonContent = domainEntity.buttonContent;

    persistenceEntity.title = domainEntity.title;

    persistenceEntity.language = domainEntity.language;

    if (domainEntity.icon) {
      persistenceEntity.icon = FileMapper.toPersistence(domainEntity.icon);
    } else if (domainEntity.icon === null) {
      persistenceEntity.icon = null;
    }

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
