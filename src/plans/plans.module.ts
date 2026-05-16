import { Module, forwardRef } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlansImportService } from './plans-import.service';
import { PlansExportService } from './plans-export.service';
import { PlansGadgetkoreaImportService } from './plans-gadgetkorea-import.service';
import { PlansJapantravelsimImportService } from './plans-japantravelsim-import.service';
import { ExchangeRateCronService } from './exchange-rate-cron.service';
import { RelationalPlanPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { DestinationsModule } from '../destinations/destinations.module';
import { RegionsModule } from '../regions/regions.module';
import { ProfitMarginsModule } from '../profit-margins/profit-margins.module';

const infrastructurePersistenceModule = RelationalPlanPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    DestinationsModule,
    RegionsModule,
    forwardRef(() => ProfitMarginsModule),
  ],
  controllers: [PlansController],
  providers: [
    PlansService,
    PlansImportService,
    PlansExportService,
    PlansGadgetkoreaImportService,
    PlansJapantravelsimImportService,
    ExchangeRateCronService,
  ],
  exports: [PlansService, infrastructurePersistenceModule],
})
export class PlansModule {}
