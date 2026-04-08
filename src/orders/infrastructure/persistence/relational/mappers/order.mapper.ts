import { UserMapper } from '../../../../../users/infrastructure/persistence/relational/mappers/user.mapper';
import { Order } from '../../../../domain/order';
import { OrderEntity } from '../entities/order.entity';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

export class OrderMapper {
  static toDomain(raw: OrderEntity): Order {
    const domainEntity = new Order();
    domainEntity.id = raw.id;
    domainEntity.userId = raw.userId;
    if (raw.user) {
      domainEntity.user = UserMapper.toDomain(raw.user);
    }
    domainEntity.orderNumber = raw.orderNumber;
    domainEntity.status = raw.status;
    domainEntity.totalAmount = Number(raw.totalAmount);
    domainEntity.currency = raw.currency;
    domainEntity.paymentMethod = raw.paymentMethod;
    domainEntity.paymentId = raw.paymentId;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Order): OrderEntity {
    const persistenceEntity = new OrderEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.userId = domainEntity.userId;
    if (domainEntity.user) {
      const userEntity = new UserEntity();
      userEntity.id = Number(domainEntity.user.id);
      persistenceEntity.user = userEntity;
    }
    persistenceEntity.orderNumber = domainEntity.orderNumber;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.totalAmount = domainEntity.totalAmount;
    persistenceEntity.currency = domainEntity.currency;
    persistenceEntity.paymentMethod = domainEntity.paymentMethod;
    persistenceEntity.paymentId = domainEntity.paymentId;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
