import { Invoice } from '../../../../domain/invoice';

import { OrderMapper } from '../../../../../orders/infrastructure/persistence/relational/mappers/order.mapper';

import { InvoiceEntity } from '../entities/invoice.entity';

export class InvoiceMapper {
  static toDomain(raw: InvoiceEntity): Invoice {
    const domainEntity = new Invoice();
    domainEntity.status = raw.status;

    domainEntity.invoicePhone = raw.invoicePhone;

    domainEntity.invoiceEmail = raw.invoiceEmail;

    domainEntity.address = raw.address;

    domainEntity.taxCode = raw.taxCode;

    domainEntity.companyName = raw.companyName;

    domainEntity.orderId = raw.orderId;

    if (raw.order) {
      domainEntity.order = OrderMapper.toDomain(raw.order);
    }

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Invoice): InvoiceEntity {
    const persistenceEntity = new InvoiceEntity();
    persistenceEntity.status = domainEntity.status;

    persistenceEntity.invoicePhone = domainEntity.invoicePhone;

    persistenceEntity.invoiceEmail = domainEntity.invoiceEmail;

    persistenceEntity.address = domainEntity.address;

    persistenceEntity.taxCode = domainEntity.taxCode;

    persistenceEntity.companyName = domainEntity.companyName;

    if (domainEntity.orderId !== undefined) {
      persistenceEntity.orderId = domainEntity.orderId;
    }

    if (domainEntity.order) {
      persistenceEntity.order = OrderMapper.toPersistence(domainEntity.order);
      if (persistenceEntity.orderId === undefined && domainEntity.order.id) {
        persistenceEntity.orderId = domainEntity.order.id;
      }
    }

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
