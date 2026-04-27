import { Esim } from '../../../../domain/esim';
import { EsimEntity } from '../entities/esim.entity';
import { UserMapper } from '../../../../../users/infrastructure/persistence/relational/mappers/user.mapper';
import { PlanMapper } from '../../../../../plans/infrastructure/persistence/relational/mappers/plan.mapper';

export class EsimMapper {
  static toDomain(raw: EsimEntity): Esim {
    const domainEntity = new Esim();
    domainEntity.id = raw.id;
    domainEntity.orderItemId = raw.orderItemId;
    domainEntity.userId = raw.userId;
    domainEntity.planId = raw.planId;
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
    domainEntity.esimTranNo = raw.esimTranNo;
    domainEntity.provider = raw.provider;
    domainEntity.phoneNumber = raw.phoneNumber;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    if (raw.user !== undefined) {
      domainEntity.user = raw.user ? UserMapper.toDomain(raw.user) : null;
    }
    if (raw.plan !== undefined) {
      domainEntity.plan = raw.plan ? PlanMapper.toDomain(raw.plan) : null;
    }
    return domainEntity;
  }

  static toPersistence(domainEntity: Esim): EsimEntity {
    const persistenceEntity = new EsimEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.orderItemId = domainEntity.orderItemId;
    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.planId = domainEntity.planId;
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
    persistenceEntity.esimTranNo = domainEntity.esimTranNo;
    persistenceEntity.provider = domainEntity.provider;
    persistenceEntity.phoneNumber = domainEntity.phoneNumber;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
