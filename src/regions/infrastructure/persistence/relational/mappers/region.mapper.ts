import { Region } from '../../../../domain/region';
import { RegionEntity } from '../entities/region.entity';

export class RegionMapper {
  static toDomain(raw: RegionEntity): Region {
    const domainEntity = new Region();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.slug = raw.slug;
    domainEntity.parentId = raw.parentId;
    if (raw.parent) {
      domainEntity.parent = RegionMapper.toDomain(raw.parent);
    }
    if (raw.children) {
      domainEntity.children = raw.children.map(RegionMapper.toDomain);
    }
    domainEntity.avatarUrl = raw.avatarUrl;
    domainEntity.isActive = raw.isActive;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Region): RegionEntity {
    const persistenceEntity = new RegionEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.slug = domainEntity.slug;
    persistenceEntity.parentId = domainEntity.parentId;
    persistenceEntity.avatarUrl = domainEntity.avatarUrl;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
