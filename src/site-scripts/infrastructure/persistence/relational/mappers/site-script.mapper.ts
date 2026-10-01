import { SiteScript } from '../../../../domain/site-script';
import { SiteScriptEntity } from '../entities/site-script.entity';

export class SiteScriptMapper {
  static toDomain(raw: SiteScriptEntity): SiteScript {
    const domainEntity = new SiteScript();
    domainEntity.name = raw.name;
    domainEntity.content = raw.content;
    domainEntity.placement = raw.placement;
    domainEntity.isActive = !!raw.isActive;
    domainEntity.sortOrder = Number(raw.sortOrder ?? 0);
    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: SiteScript): SiteScriptEntity {
    const persistenceEntity = new SiteScriptEntity();
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.content = domainEntity.content;
    persistenceEntity.placement = domainEntity.placement;
    persistenceEntity.isActive = domainEntity.isActive ?? true;
    persistenceEntity.sortOrder = domainEntity.sortOrder ?? 0;
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
