import { Module, forwardRef } from '@nestjs/common';
import { EsimsController, EsimsPublicController } from './esims.controller';
import { EsimsService } from './esims.service';
import { EsimsImportService } from './esims-import.service';
import { EsimsExportService } from './esims-export.service';
import { RelationalEsimPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { EsimProvidersModule } from '../esim-providers/esim-providers.module';
import { PlansModule } from '../plans/plans.module';
import { ProfitMarginsModule } from '../profit-margins/profit-margins.module';
import { DestinationsModule } from '../destinations/destinations.module';

const infrastructurePersistenceModule = RelationalEsimPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    forwardRef(() => EsimProvidersModule),
    PlansModule,
    ProfitMarginsModule,
    DestinationsModule,
  ],
  controllers: [EsimsPublicController, EsimsController],
  providers: [EsimsService, EsimsImportService, EsimsExportService],
  exports: [EsimsService, infrastructurePersistenceModule],
})
export class EsimsModule {}
