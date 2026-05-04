import { Footer } from '../../../../domain/footer';

import { FooterEntity } from '../entities/footer.entity';

export class FooterMapper {
  static toDomain(raw: FooterEntity): Footer {
    const domainEntity = new Footer();
    domainEntity.categories = raw.categories;

    domainEntity.url = raw.url;

    domainEntity.title = raw.title;

    domainEntity.titleVi = raw.titleVi;

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Footer): FooterEntity {
    const persistenceEntity = new FooterEntity();
    persistenceEntity.categories = domainEntity.categories;

    persistenceEntity.url = domainEntity.url;

    persistenceEntity.title = domainEntity.title;

    persistenceEntity.titleVi = domainEntity.titleVi;

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
