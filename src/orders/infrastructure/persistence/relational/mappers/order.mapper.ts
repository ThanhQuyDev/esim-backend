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
    domainEntity.couponCode = raw.couponCode;
    domainEntity.discountAmount = Number(raw.discountAmount);
    domainEntity.vndPrice = Number(raw.vndPrice);
    domainEntity.vndCostPrice = Number(raw.vndCostPrice);
    domainEntity.subtotalVndPrice = Number(raw.subtotalVndPrice);
    domainEntity.couponDiscountVndAmount = Number(raw.couponDiscountVndAmount);
    domainEntity.referralCode = raw.referralCode;
    domainEntity.referrerUserId = raw.referrerUserId;
    domainEntity.referralDiscountVndAmount = Number(
      raw.referralDiscountVndAmount,
    );
    domainEntity.walletSpentVndAmount = Number(raw.walletSpentVndAmount);
    domainEntity.payableVndPrice = Number(raw.payableVndPrice);
    domainEntity.cashbackAmountVnd = Number(raw.cashbackAmountVnd);
    domainEntity.cashbackTransactionId = raw.cashbackTransactionId;
    domainEntity.cashbackReversedAt = raw.cashbackReversedAt;
    domainEntity.refundStatus = raw.refundStatus;
    domainEntity.refundedAmountVnd = Number(raw.refundedAmountVnd);
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Partial<Order>): OrderEntity {
    const persistenceEntity = new OrderEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    if (domainEntity.userId !== undefined) {
      persistenceEntity.userId = domainEntity.userId;
    }
    if (domainEntity.user) {
      const userEntity = new UserEntity();
      userEntity.id = Number(domainEntity.user.id);
      persistenceEntity.user = userEntity;
    }
    if (domainEntity.orderNumber !== undefined) {
      persistenceEntity.orderNumber = domainEntity.orderNumber;
    }
    if (domainEntity.status !== undefined) {
      persistenceEntity.status = domainEntity.status;
    }
    if (domainEntity.totalAmount !== undefined) {
      persistenceEntity.totalAmount = domainEntity.totalAmount;
    }
    if (domainEntity.currency !== undefined) {
      persistenceEntity.currency = domainEntity.currency;
    }
    persistenceEntity.paymentMethod = domainEntity.paymentMethod;
    persistenceEntity.paymentId = domainEntity.paymentId;
    persistenceEntity.couponCode = domainEntity.couponCode;
    persistenceEntity.discountAmount = domainEntity.discountAmount ?? 0;
    persistenceEntity.vndPrice = domainEntity.vndPrice ?? 0;
    persistenceEntity.vndCostPrice = domainEntity.vndCostPrice ?? 0;
    persistenceEntity.subtotalVndPrice = domainEntity.subtotalVndPrice ?? 0;
    persistenceEntity.couponDiscountVndAmount =
      domainEntity.couponDiscountVndAmount ?? 0;
    persistenceEntity.referralCode = domainEntity.referralCode;
    persistenceEntity.referrerUserId = domainEntity.referrerUserId;
    persistenceEntity.referralDiscountVndAmount =
      domainEntity.referralDiscountVndAmount ?? 0;
    persistenceEntity.walletSpentVndAmount =
      domainEntity.walletSpentVndAmount ?? 0;
    persistenceEntity.payableVndPrice = domainEntity.payableVndPrice ?? 0;
    persistenceEntity.cashbackAmountVnd = domainEntity.cashbackAmountVnd ?? 0;
    persistenceEntity.cashbackTransactionId =
      domainEntity.cashbackTransactionId;
    persistenceEntity.cashbackReversedAt = domainEntity.cashbackReversedAt;
    persistenceEntity.refundStatus = domainEntity.refundStatus;
    persistenceEntity.refundedAmountVnd = domainEntity.refundedAmountVnd ?? 0;
    if (domainEntity.createdAt !== undefined) {
      persistenceEntity.createdAt = domainEntity.createdAt;
    }
    if (domainEntity.updatedAt !== undefined) {
      persistenceEntity.updatedAt = domainEntity.updatedAt;
    }
    if (domainEntity.deletedAt !== undefined) {
      persistenceEntity.deletedAt = domainEntity.deletedAt;
    }
    return persistenceEntity;
  }
}
