import { ProfitMarginTier } from '../../../../domain/profit-margin-tier';
import { ProfitMarginTierEntity } from '../entities/profit-margin-tier.entity';

export class ProfitMarginTierMapper {
  static toDomain(raw: ProfitMarginTierEntity): ProfitMarginTier {
    const domainEntity = new ProfitMarginTier();
    domainEntity.id = raw.id;
    domainEntity.minVnd = raw.minVnd;
    domainEntity.maxVnd = raw.maxVnd;
    domainEntity.percentage = raw.percentage;
    domainEntity.isActive = raw.isActive;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ProfitMarginTier): ProfitMarginTierEntity {
    const persistenceEntity = new ProfitMarginTierEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.minVnd = domainEntity.minVnd;
    persistenceEntity.maxVnd = domainEntity.maxVnd;
    persistenceEntity.percentage = domainEntity.percentage;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
