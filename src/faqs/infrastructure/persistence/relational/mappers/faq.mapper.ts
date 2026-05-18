import { Faq } from '../../../../domain/faq';

import { FaqEntity } from '../entities/faq.entity';

export class FaqMapper {
  static toDomain(raw: FaqEntity): Faq {
    const domainEntity = new Faq();
    domainEntity.url = raw.url;
    domainEntity.language = raw.language;

    domainEntity.isActive = raw.isActive;

    domainEntity.sortOrder = raw.sortOrder;

    domainEntity.answer = raw.answer;

    domainEntity.question = raw.question;

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Faq): FaqEntity {
    const persistenceEntity = new FaqEntity();
    persistenceEntity.url = domainEntity.url;
    persistenceEntity.language = domainEntity.language;

    persistenceEntity.isActive = domainEntity.isActive;

    persistenceEntity.sortOrder = domainEntity.sortOrder;

    persistenceEntity.answer = domainEntity.answer;

    persistenceEntity.question = domainEntity.question;

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
