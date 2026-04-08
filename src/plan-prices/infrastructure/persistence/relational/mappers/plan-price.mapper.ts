import { PlanPrice } from '../../../../domain/plan-price';
import { PlanPriceEntity } from '../entities/plan-price.entity';

export class PlanPriceMapper {
  static toDomain(raw: PlanPriceEntity): PlanPrice {
    const domainEntity = new PlanPrice();
    domainEntity.id = raw.id;
    domainEntity.planId = raw.planId;
    if (raw.plan) {
      domainEntity.plan = raw.plan as any;
    }
    domainEntity.currency = raw.currency;
    domainEntity.price = Number(raw.price);
    domainEntity.originalPrice =
      raw.originalPrice !== null ? Number(raw.originalPrice) : null;
    domainEntity.isActive = raw.isActive;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: PlanPrice): PlanPriceEntity {
    const persistenceEntity = new PlanPriceEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.planId = domainEntity.planId;
    persistenceEntity.currency = domainEntity.currency;
    persistenceEntity.price = domainEntity.price;
    persistenceEntity.originalPrice = domainEntity.originalPrice;
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
