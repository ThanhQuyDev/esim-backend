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
    domainEntity.iconUrl = raw.iconUrl;
    domainEntity.description = raw.description;
    domainEntity.descriptionVi = raw.descriptionVi;
    domainEntity.providers = raw.providers ?? null;
    domainEntity.isActive = raw.isActive;
    domainEntity.isPopular = raw.isPopular;
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
    persistenceEntity.iconUrl = domainEntity.iconUrl;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.descriptionVi = domainEntity.descriptionVi;
    persistenceEntity.providers = domainEntity.providers ?? null;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.isPopular = domainEntity.isPopular;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
