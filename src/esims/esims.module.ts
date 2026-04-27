import { Module } from '@nestjs/common';
import { EsimsController, EsimsPublicController } from './esims.controller';
import { EsimsService } from './esims.service';
import { EsimsImportService } from './esims-import.service';
import { RelationalEsimPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { EsimProvidersModule } from '../esim-providers/esim-providers.module';
import { PlansModule } from '../plans/plans.module';
import { ProfitMarginsModule } from '../profit-margins/profit-margins.module';

const infrastructurePersistenceModule = RelationalEsimPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    EsimProvidersModule,
    PlansModule,
    ProfitMarginsModule,
  ],
  controllers: [EsimsPublicController, EsimsController],
  providers: [EsimsService, EsimsImportService],
  exports: [EsimsService, infrastructurePersistenceModule],
})
export class EsimsModule {}
