import { Esim } from '../../../../domain/esim';
import { EsimEntity } from '../entities/esim.entity';

export class EsimMapper {
  static toDomain(raw: EsimEntity): Esim {
    const domainEntity = new Esim();
    domainEntity.id = raw.id;
    domainEntity.orderItemId = raw.orderItemId;
    domainEntity.userId = raw.userId;
    domainEntity.iccid = raw.iccid;
    domainEntity.smdpAddress = raw.smdpAddress;
    domainEntity.activationCode = raw.activationCode;
    domainEntity.lpa = raw.lpa;
    domainEntity.matchId = raw.matchId;
    domainEntity.qrcode = raw.qrcode;
    domainEntity.directAppleInstallationUrl = raw.directAppleInstallationUrl;
    domainEntity.apnValue = raw.apnValue;
    domainEntity.isRoaming = raw.isRoaming;
    domainEntity.status = raw.status;
    domainEntity.dataUsed = raw.dataUsed;
    domainEntity.dataTotal = raw.dataTotal;
    domainEntity.expiresAt = raw.expiresAt;
    domainEntity.activatedAt = raw.activatedAt;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Esim): EsimEntity {
    const persistenceEntity = new EsimEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.orderItemId = domainEntity.orderItemId;
    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.iccid = domainEntity.iccid;
    persistenceEntity.smdpAddress = domainEntity.smdpAddress;
    persistenceEntity.activationCode = domainEntity.activationCode;
    persistenceEntity.lpa = domainEntity.lpa;
    persistenceEntity.matchId = domainEntity.matchId;
    persistenceEntity.qrcode = domainEntity.qrcode;
    persistenceEntity.directAppleInstallationUrl =
      domainEntity.directAppleInstallationUrl;
    persistenceEntity.apnValue = domainEntity.apnValue;
    persistenceEntity.isRoaming = domainEntity.isRoaming;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.dataUsed = domainEntity.dataUsed;
    persistenceEntity.dataTotal = domainEntity.dataTotal;
    persistenceEntity.expiresAt = domainEntity.expiresAt;
    persistenceEntity.activatedAt = domainEntity.activatedAt;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
