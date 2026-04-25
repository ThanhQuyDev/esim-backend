import { SupportedDevice } from '../../../../domain/supported-device';
import { SupportedDeviceEntity } from '../entities/supported-device.entity';

export class SupportedDeviceMapper {
  static toDomain(raw: SupportedDeviceEntity): SupportedDevice {
    const domain = new SupportedDevice();
    domain.id = raw.id;
    domain.device = raw.device;
    domain.manufacturer = raw.manufacturer;
    domain.type = raw.type;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }

  static toPersistence(domain: SupportedDevice): SupportedDeviceEntity {
    const entity = new SupportedDeviceEntity();
    if (domain.id) entity.id = domain.id;
    entity.device = domain.device;
    entity.manufacturer = domain.manufacturer;
    entity.type = domain.type;
    return entity;
  }
}
