import { Module, forwardRef } from '@nestjs/common';
import { ProfitMarginsController } from './profit-margins.controller';
import { ProfitMarginsService } from './profit-margins.service';
import { RelationalProfitMarginPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { PlansModule } from '../plans/plans.module';
import { PriceDisplayService } from './price-display.service';

const infrastructurePersistenceModule = RelationalProfitMarginPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule, forwardRef(() => PlansModule)],
  controllers: [ProfitMarginsController],
  providers: [ProfitMarginsService, PriceDisplayService],
  exports: [
    ProfitMarginsService,
    PriceDisplayService,
    infrastructurePersistenceModule,
  ],
})
export class ProfitMarginsModule {}
