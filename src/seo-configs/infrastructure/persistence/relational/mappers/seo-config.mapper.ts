import { SeoConfig } from '../../../../domain/seo-config';
import { SeoConfigEntity } from '../entities/seo-config.entity';

export class SeoConfigMapper {
  static toDomain(raw: SeoConfigEntity): SeoConfig {
    const domainEntity = new SeoConfig();
    domainEntity.id = raw.id;
    domainEntity.url = raw.url;
    domainEntity.metaTitle = raw.metaTitle;
    domainEntity.metaDescription = raw.metaDescription;
    domainEntity.metaKeywords = raw.metaKeywords;
    domainEntity.ogImage = raw.ogImage;
    domainEntity.ogTitle = raw.ogTitle;
    domainEntity.ogDescription = raw.ogDescription;
    domainEntity.destinationId = raw.destinationId;
    domainEntity.regionId = raw.regionId;
    domainEntity.planId = raw.planId;
    domainEntity.isActive = raw.isActive;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: SeoConfig): SeoConfigEntity {
    const persistenceEntity = new SeoConfigEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.url = domainEntity.url;
    persistenceEntity.metaTitle = domainEntity.metaTitle;
    persistenceEntity.metaDescription = domainEntity.metaDescription;
    persistenceEntity.metaKeywords = domainEntity.metaKeywords;
    persistenceEntity.ogImage = domainEntity.ogImage;
    persistenceEntity.ogTitle = domainEntity.ogTitle;
    persistenceEntity.ogDescription = domainEntity.ogDescription;
    persistenceEntity.destinationId = domainEntity.destinationId;
    persistenceEntity.regionId = domainEntity.regionId;
    persistenceEntity.planId = domainEntity.planId;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
