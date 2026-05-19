import { CustomPaymentLink } from '../../../../domain/custom-payment-link';
import { UserMapper } from '../../../../../users/infrastructure/persistence/relational/mappers/user.mapper';

import { CustomPaymentLinkEntity } from '../entities/custom-payment-link.entity';

export class CustomPaymentLinkMapper {
  static toDomain(raw: CustomPaymentLinkEntity): CustomPaymentLink {
    const domainEntity = new CustomPaymentLink();
    domainEntity.createdById = raw.createdById ?? null;

    if (raw.createdBy) {
      domainEntity.createdBy = UserMapper.toDomain(raw.createdBy);
    } else if (raw.createdBy === null) {
      domainEntity.createdBy = null;
    }

    domainEntity.paymentId = raw.paymentId;

    domainEntity.status = raw.status;

    domainEntity.paymentUrl = raw.paymentUrl;

    domainEntity.description = raw.description;

    domainEntity.currency = raw.currency;

    domainEntity.amount = Number(raw.amount);

    domainEntity.customerEmail = raw.customerEmail;

    domainEntity.virtualOrderId = raw.virtualOrderId;

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(
    domainEntity: CustomPaymentLink,
  ): CustomPaymentLinkEntity {
    const persistenceEntity = new CustomPaymentLinkEntity();
    if (domainEntity.createdById !== undefined) {
      persistenceEntity.createdById = domainEntity.createdById;
    }

    if (domainEntity.createdBy) {
      persistenceEntity.createdBy = UserMapper.toPersistence(
        domainEntity.createdBy,
      );
      if (
        persistenceEntity.createdById == null &&
        domainEntity.createdBy.id != null
      ) {
        persistenceEntity.createdById = Number(domainEntity.createdBy.id);
      }
    } else if (domainEntity.createdBy === null) {
      persistenceEntity.createdBy = null;
    }

    persistenceEntity.paymentId = domainEntity.paymentId;

    persistenceEntity.status = domainEntity.status;

    persistenceEntity.paymentUrl = domainEntity.paymentUrl;

    persistenceEntity.description = domainEntity.description;

    persistenceEntity.currency = domainEntity.currency;

    persistenceEntity.amount = domainEntity.amount;

    persistenceEntity.customerEmail = domainEntity.customerEmail;

    persistenceEntity.virtualOrderId = domainEntity.virtualOrderId;

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
