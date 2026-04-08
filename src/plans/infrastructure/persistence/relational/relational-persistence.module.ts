import { Module } from '@nestjs/common';
import { PlanRepository } from '../plan.repository';
import { PlansRelationalRepository } from './repositories/plan.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanEntity } from './entities/plan.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlanEntity])],
  providers: [
    {
      provide: PlanRepository,
      useClass: PlansRelationalRepository,
    },
  ],
  exports: [PlanRepository],
})
export class RelationalPlanPersistenceModule {}
