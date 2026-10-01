import { Module, forwardRef } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlansImportService } from './plans-import.service';
import { PlansExportService } from './plans-export.service';
import { PlansGadgetkoreaImportService } from './plans-gadgetkorea-import.service';
import { ExchangeRateCronService } from './exchange-rate-cron.service';
import { ExchangeRateService } from './exchange-rate.service';
import { SoldCountCronService } from './sold-count-cron.service';
import { RelationalPlanPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { DestinationsModule } from '../destinations/destinations.module';
import { RegionsModule } from '../regions/regions.module';
import { ProfitMarginsModule } from '../profit-margins/profit-margins.module';
import { ApnSupportModule } from '../apn-support/apn-support.module';

const infrastructurePersistenceModule = RelationalPlanPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    DestinationsModule,
    RegionsModule,
    forwardRef(() => ProfitMarginsModule),
    // Judging TikTok / ChatGPT support from the uploaded APN table (#067).
    ApnSupportModule,
  ],
  controllers: [PlansController],
  providers: [
    PlansService,
    PlansImportService,
    PlansExportService,
    PlansGadgetkoreaImportService,
    ExchangeRateCronService,
    ExchangeRateService,
    SoldCountCronService,
  ],
  exports: [PlansService, ExchangeRateService, infrastructurePersistenceModule],
})
export class PlansModule {}
