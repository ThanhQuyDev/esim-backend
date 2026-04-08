import { Module } from '@nestjs/common';
import { PlanPricesController } from './plan-prices.controller';
import { PlanPricesService } from './plan-prices.service';
import { RelationalPlanPricePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalPlanPricePersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [PlanPricesController],
  providers: [PlanPricesService],
  exports: [PlanPricesService, infrastructurePersistenceModule],
})
export class PlanPricesModule {}
