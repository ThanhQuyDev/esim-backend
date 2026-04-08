import { ProfitMargin } from '../../../../domain/profit-margin';
import { ProfitMarginEntity } from '../entities/profit-margin.entity';

export class ProfitMarginMapper {
  static toDomain(raw: ProfitMarginEntity): ProfitMargin {
    const domainEntity = new ProfitMargin();
    domainEntity.id = raw.id;
    domainEntity.name = raw.name;
    domainEntity.percentage = raw.percentage;
    domainEntity.isActive = raw.isActive;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ProfitMargin): ProfitMarginEntity {
    const persistenceEntity = new ProfitMarginEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.name = domainEntity.name;
    persistenceEntity.percentage = domainEntity.percentage;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
