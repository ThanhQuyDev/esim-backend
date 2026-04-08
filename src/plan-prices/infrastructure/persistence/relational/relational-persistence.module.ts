import { Module } from '@nestjs/common';
import { PlanPriceRepository } from '../plan-price.repository';
import { PlanPricesRelationalRepository } from './repositories/plan-price.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanPriceEntity } from './entities/plan-price.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlanPriceEntity])],
  providers: [
    {
      provide: PlanPriceRepository,
      useClass: PlanPricesRelationalRepository,
    },
  ],
  exports: [PlanPriceRepository],
})
export class RelationalPlanPricePersistenceModule {}
