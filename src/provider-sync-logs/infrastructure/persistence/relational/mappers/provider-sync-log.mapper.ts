import { ProviderSyncLog } from '../../../../domain/provider-sync-log';
import { ProviderSyncLogEntity } from '../entities/provider-sync-log.entity';

export class ProviderSyncLogMapper {
  static toDomain(raw: ProviderSyncLogEntity): ProviderSyncLog {
    const domainEntity = new ProviderSyncLog();
    domainEntity.id = raw.id;
    domainEntity.provider = raw.provider;
    domainEntity.syncType = raw.syncType;
    domainEntity.status = raw.status;
    domainEntity.itemsSynced = raw.itemsSynced;
    domainEntity.errorMessage = raw.errorMessage;
    domainEntity.startedAt = raw.startedAt;
    domainEntity.completedAt = raw.completedAt;
    domainEntity.createdAt = raw.createdAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: ProviderSyncLog): ProviderSyncLogEntity {
    const persistenceEntity = new ProviderSyncLogEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.provider = domainEntity.provider;
    persistenceEntity.syncType = domainEntity.syncType;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.itemsSynced = domainEntity.itemsSynced;
    persistenceEntity.errorMessage = domainEntity.errorMessage;
    persistenceEntity.startedAt = domainEntity.startedAt;
    persistenceEntity.completedAt = domainEntity.completedAt;
    persistenceEntity.createdAt = domainEntity.createdAt;
    return persistenceEntity;
  }
}
