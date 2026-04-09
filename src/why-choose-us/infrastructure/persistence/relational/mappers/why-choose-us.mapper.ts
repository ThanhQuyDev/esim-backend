import { WhyChooseUs } from '../../../../domain/why-choose-us';

import { WhyChooseUsEntity } from '../entities/why-choose-us.entity';

export class WhyChooseUsMapper {
  static toDomain(raw: WhyChooseUsEntity): WhyChooseUs {
    const domainEntity = new WhyChooseUs();
    domainEntity.language = raw.language;

    domainEntity.isActive = raw.isActive;

    domainEntity.sortOrder = raw.sortOrder;

    domainEntity.icon = raw.icon;

    domainEntity.description = raw.description;

    domainEntity.title = raw.title;

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: WhyChooseUs): WhyChooseUsEntity {
    const persistenceEntity = new WhyChooseUsEntity();
    persistenceEntity.language = domainEntity.language;

    persistenceEntity.isActive = domainEntity.isActive;

    persistenceEntity.sortOrder = domainEntity.sortOrder;

    persistenceEntity.icon = domainEntity.icon;

    persistenceEntity.description = domainEntity.description;

    persistenceEntity.title = domainEntity.title;

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
