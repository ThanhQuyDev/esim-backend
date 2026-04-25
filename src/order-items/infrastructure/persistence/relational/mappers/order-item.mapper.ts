import { OrderItem } from '../../../../domain/order-item';
import { OrderItemEntity } from '../entities/order-item.entity';
import { PlanMapper } from '../../../../../plans/infrastructure/persistence/relational/mappers/plan.mapper';

export class OrderItemMapper {
  static toDomain(raw: OrderItemEntity): OrderItem {
    const domainEntity = new OrderItem();
    domainEntity.id = raw.id;
    domainEntity.orderId = raw.orderId;
    domainEntity.planId = raw.planId;
    if (raw.plan) {
      domainEntity.plan = PlanMapper.toDomain(raw.plan);
    }
    domainEntity.orderRequestId = raw.orderRequestId;
    domainEntity.providerOrderId = raw.providerOrderId;
    domainEntity.providerOrderCode = raw.providerOrderCode;
    domainEntity.status = raw.status;
    domainEntity.price = raw.price;
    domainEntity.currency = raw.currency;
    domainEntity.quantity = raw.quantity;
    domainEntity.vndPrice = Number(raw.vndPrice);
    domainEntity.vndCostPrice = Number(raw.vndCostPrice);
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
    persistenceEntity.orderRequestId = domainEntity.orderRequestId;
    persistenceEntity.providerOrderId = domainEntity.providerOrderId;
    persistenceEntity.providerOrderCode = domainEntity.providerOrderCode;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.price = domainEntity.price;
    persistenceEntity.currency = domainEntity.currency;
    persistenceEntity.quantity = domainEntity.quantity;
    persistenceEntity.vndPrice = domainEntity.vndPrice ?? 0;
    persistenceEntity.vndCostPrice = domainEntity.vndCostPrice ?? 0;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
