import { Destination } from '../../../../domain/destination';
import { DestinationEntity } from '../entities/destination.entity';
import { RegionMapper } from '../../../../../regions/infrastructure/persistence/relational/mappers/region.mapper';

export class DestinationMapper {
  static toDomain(raw: DestinationEntity): Destination {
    const domainEntity = new Destination();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.slug = raw.slug;
    domainEntity.countryCode = raw.countryCode;
    if (raw.regions) {
      domainEntity.regions = raw.regions.map(RegionMapper.toDomain);
    }
    domainEntity.flagUrl = raw.flagUrl;
    domainEntity.avatarUrl = raw.avatarUrl;
    domainEntity.keySearch = raw.keySearch;
    domainEntity.isPopular = raw.isPopular;
    domainEntity.isActive = raw.isActive;
    domainEntity.description = raw.description;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Destination): DestinationEntity {
    const persistenceEntity = new DestinationEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.slug = domainEntity.slug;
    persistenceEntity.countryCode = domainEntity.countryCode;
    persistenceEntity.flagUrl = domainEntity.flagUrl;
    persistenceEntity.avatarUrl = domainEntity.avatarUrl;
    persistenceEntity.keySearch = domainEntity.keySearch;
    persistenceEntity.isPopular = domainEntity.isPopular;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
