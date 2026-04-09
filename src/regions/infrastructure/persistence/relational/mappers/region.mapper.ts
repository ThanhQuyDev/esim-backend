import { Region } from '../../../../domain/region';
import { RegionEntity } from '../entities/region.entity';
import { DestinationMapper } from '../../../../../destinations/infrastructure/persistence/relational/mappers/destination.mapper';

export class RegionMapper {
  static toDomain(raw: RegionEntity): Region {
    const domainEntity = new Region();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.slug = raw.slug;
    if (raw.destinations) {
      domainEntity.destinations = raw.destinations.map(
        DestinationMapper.toDomain,
      );
      domainEntity.destinationCount = raw.destinations.length;
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
    persistenceEntity.avatarUrl = domainEntity.avatarUrl;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
