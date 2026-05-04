import { HeroBanner } from '../../../../domain/hero-banner';

import { FileMapper } from '../../../../../files/infrastructure/persistence/relational/mappers/file.mapper';

import { HeroBannerEntity } from '../entities/hero-banner.entity';

export class HeroBannerMapper {
  static toDomain(raw: HeroBannerEntity): HeroBanner {
    const domainEntity = new HeroBanner();
    domainEntity.active = raw.active;

    if (raw.image) {
      domainEntity.image = FileMapper.toDomain(raw.image);
    } else if (raw.image === null) {
      domainEntity.image = null;
    }

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: HeroBanner): HeroBannerEntity {
    const persistenceEntity = new HeroBannerEntity();
    persistenceEntity.active = domainEntity.active;

    if (domainEntity.image) {
      persistenceEntity.image = FileMapper.toPersistence(domainEntity.image);
    } else if (domainEntity.image === null) {
      persistenceEntity.image = null;
    }

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
