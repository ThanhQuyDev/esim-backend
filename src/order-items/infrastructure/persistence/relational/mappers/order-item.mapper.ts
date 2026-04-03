import { OrderItem } from '../../../../domain/order-item';
import { OrderItemEntity } from '../entities/order-item.entity';

export class OrderItemMapper {
  static toDomain(raw: OrderItemEntity): OrderItem {
    const domainEntity = new OrderItem();
    domainEntity.id = raw.id;
    domainEntity.orderId = raw.orderId;
    domainEntity.planId = raw.planId;
    domainEntity.planPriceId = raw.planPriceId;
    domainEntity.price = raw.price;
    domainEntity.currency = raw.currency;
    domainEntity.quantity = raw.quantity;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: OrderItem): OrderItemEntity {
    const persistenceEntity = new OrderItemEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.orderId = domainEntity.orderId;
    persistenceEntity.planId = domainEntity.planId;
    persistenceEntity.planPriceId = domainEntity.planPriceId;
    persistenceEntity.price = domainEntity.price;
    persistenceEntity.currency = domainEntity.currency;
    persistenceEntity.quantity = domainEntity.quantity;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
