import { MenuSlide } from '../../../../domain/menu-slide';
import { MenuSlideEntity } from '../entities/menu-slide.entity';

export class MenuSlideMapper {
  static toDomain(raw: MenuSlideEntity): MenuSlide {
    const domainEntity = new MenuSlide();
    domainEntity.menuKey = raw.menuKey;
    domainEntity.title = raw.title;
    domainEntity.description = raw.description;
    domainEntity.href = raw.href;
    domainEntity.image = raw.image;
    domainEntity.imageAlt = raw.imageAlt ?? null;
    domainEntity.language = raw.language;
    domainEntity.sortOrder = Number(raw.sortOrder ?? 0);
    domainEntity.isActive = !!raw.isActive;
    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: MenuSlide): MenuSlideEntity {
    const persistenceEntity = new MenuSlideEntity();
    persistenceEntity.menuKey = domainEntity.menuKey;
    persistenceEntity.title = domainEntity.title;
    persistenceEntity.description = domainEntity.description;
    persistenceEntity.href = domainEntity.href;
    persistenceEntity.image = domainEntity.image;
    persistenceEntity.imageAlt = domainEntity.imageAlt ?? null;
    persistenceEntity.language = domainEntity.language;
    persistenceEntity.sortOrder = domainEntity.sortOrder ?? 0;
    persistenceEntity.isActive = domainEntity.isActive ?? true;

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
