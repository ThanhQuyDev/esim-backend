import { HelpCenter } from '../../../../domain/help-center';
import { HelpCenterEntity } from '../entities/help-center.entity';

export class HelpCenterMapper {
  static toDomain(raw: HelpCenterEntity): HelpCenter {
    const domain = new HelpCenter();
    domain.id = raw.id;
    domain.slug = raw.slug;
    domain.language = raw.language;
    domain.title = raw.title;
    domain.content = raw.content;
    domain.order = raw.order;
    domain.category = raw.category;
    domain.parent = raw.parent;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }

  static toPersistence(domain: HelpCenter): HelpCenterEntity {
    const entity = new HelpCenterEntity();
    if (domain.id) entity.id = domain.id;
    entity.slug = domain.slug;
    entity.language = domain.language;
    entity.title = domain.title;
    entity.content = domain.content;
    entity.order = domain.order;
    entity.category = domain.category;
    entity.parent = domain.parent;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
