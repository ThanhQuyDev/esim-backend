import { TicketEntity } from '../entities/ticket.entity';
import { Ticket } from '../../../../domain/ticket';

export class TicketMapper {
  static toDomain(raw: TicketEntity): Ticket {
    const domainEntity = new Ticket();
    domainEntity.id = raw.id;
    domainEntity.customerEmail = raw.customerEmail;
    domainEntity.subject = raw.subject;
    domainEntity.description = raw.description;
    domainEntity.orderId = raw.orderId;
    domainEntity.deviceModel = raw.deviceModel;
    domainEntity.iccid = raw.iccid;
    domainEntity.planDestination = raw.planDestination;
    domainEntity.attachments = raw.attachments;
    domainEntity.status = raw.status;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Ticket): TicketEntity {
    const persistenceEntity = new TicketEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.customerEmail = domainEntity.customerEmail;
    persistenceEntity.subject = domainEntity.subject;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.orderId = domainEntity.orderId;
    persistenceEntity.deviceModel = domainEntity.deviceModel;
    persistenceEntity.iccid = domainEntity.iccid;
    persistenceEntity.planDestination = domainEntity.planDestination;
    persistenceEntity.attachments = domainEntity.attachments;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
