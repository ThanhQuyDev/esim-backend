import { EmailTemplate } from '../../../../domain/email-template';
import { EmailTemplateEntity } from '../entities/email-template.entity';

export class EmailTemplateMapper {
  static toDomain(raw: EmailTemplateEntity): EmailTemplate {
    const domain = new EmailTemplate();
    domain.id = raw.id;
    domain.name = raw.name;
    domain.subject = raw.subject;
    domain.htmlBody = raw.htmlBody;
    domain.isActive = raw.isActive;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }

  static toPersistence(domain: EmailTemplate): EmailTemplateEntity {
    const entity = new EmailTemplateEntity();
    if (domain.id) entity.id = domain.id;
    entity.name = domain.name;
    entity.subject = domain.subject;
    entity.htmlBody = domain.htmlBody;
    entity.isActive = domain.isActive ?? true;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
