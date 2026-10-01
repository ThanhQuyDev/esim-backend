import { ManufacturerNote } from '../../../../domain/manufacturer-note';
import { ManufacturerNoteEntity } from '../entities/manufacturer-note.entity';

export class ManufacturerNoteMapper {
  static toDomain(raw: ManufacturerNoteEntity): ManufacturerNote {
    const domainEntity = new ManufacturerNote();
    domainEntity.manufacturer = raw.manufacturer;
    domainEntity.language = raw.language;
    domainEntity.note = raw.note;
    domainEntity.isActive = !!raw.isActive;
    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ManufacturerNote): ManufacturerNoteEntity {
    const persistenceEntity = new ManufacturerNoteEntity();
    persistenceEntity.manufacturer = domainEntity.manufacturer;
    persistenceEntity.language = domainEntity.language;
    persistenceEntity.note = domainEntity.note;
    persistenceEntity.isActive = domainEntity.isActive ?? true;
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
