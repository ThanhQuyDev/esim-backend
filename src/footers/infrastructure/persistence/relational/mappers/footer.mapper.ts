import { Footer } from '../../../../domain/footer';

import { FooterEntity } from '../entities/footer.entity';

export class FooterMapper {
  static toDomain(raw: FooterEntity): Footer {
    const domainEntity = new Footer();
    domainEntity.sortOrder = raw.sortOrder;
    domainEntity.categories = raw.categories;
    domainEntity.categoriesVi = raw.categoriesVi;

    domainEntity.url = raw.url;
    domainEntity.urlEn = raw.urlEn;

    domainEntity.title = raw.title;

    domainEntity.titleVi = raw.titleVi;

    domainEntity.iconUrl = raw.iconUrl;

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Footer): FooterEntity {
    const persistenceEntity = new FooterEntity();
    persistenceEntity.sortOrder = domainEntity.sortOrder ?? 0;
    persistenceEntity.categories = domainEntity.categories;
    persistenceEntity.categoriesVi = domainEntity.categoriesVi;

    persistenceEntity.url = domainEntity.url;
    persistenceEntity.urlEn = domainEntity.urlEn;

    persistenceEntity.title = domainEntity.title;

    persistenceEntity.titleVi = domainEntity.titleVi;

    persistenceEntity.iconUrl = domainEntity.iconUrl;

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
