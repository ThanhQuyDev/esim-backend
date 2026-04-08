import { Module } from '@nestjs/common';
import { ProviderSyncLogRepository } from '../provider-sync-log.repository';
import { ProviderSyncLogsRelationalRepository } from './repositories/provider-sync-log.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderSyncLogEntity } from './entities/provider-sync-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProviderSyncLogEntity])],
  providers: [
    {
      provide: ProviderSyncLogRepository,
      useClass: ProviderSyncLogsRelationalRepository,
    },
  ],
  exports: [ProviderSyncLogRepository],
})
export class RelationalProviderSyncLogPersistenceModule {}
