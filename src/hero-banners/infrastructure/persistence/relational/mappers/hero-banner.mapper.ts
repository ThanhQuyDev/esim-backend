import { HeroBanner } from '../../../../domain/hero-banner';

import { HeroBannerEntity } from '../entities/hero-banner.entity';

export class HeroBannerMapper {
  static toDomain(raw: HeroBannerEntity): HeroBanner {
    const domainEntity = new HeroBanner();
    domainEntity.active = raw.active;

    domainEntity.title = raw.title;

    domainEntity.firstIcon = raw.firstIcon;

    domainEntity.firstContent = raw.firstContent;

    domainEntity.secondIcon = raw.secondIcon;

    domainEntity.secondContent = raw.secondContent;

    domainEntity.description = raw.description;

    domainEntity.language = raw.language;

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: HeroBanner): HeroBannerEntity {
    const persistenceEntity = new HeroBannerEntity();
    persistenceEntity.active = domainEntity.active;

    persistenceEntity.title = domainEntity.title;

    persistenceEntity.firstIcon = domainEntity.firstIcon;

    persistenceEntity.firstContent = domainEntity.firstContent;

    persistenceEntity.secondIcon = domainEntity.secondIcon;

    persistenceEntity.secondContent = domainEntity.secondContent;

    persistenceEntity.description = domainEntity.description;

    persistenceEntity.language = domainEntity.language;

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
