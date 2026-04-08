import { Module } from '@nestjs/common';
import { ProviderSyncLogsController } from './provider-sync-logs.controller';
import { ProviderSyncLogsService } from './provider-sync-logs.service';
import { RelationalProviderSyncLogPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalProviderSyncLogPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [ProviderSyncLogsController],
  providers: [ProviderSyncLogsService],
  exports: [ProviderSyncLogsService, infrastructurePersistenceModule],
})
export class ProviderSyncLogsModule {}
