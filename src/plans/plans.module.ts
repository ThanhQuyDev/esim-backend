import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { RelationalPlanPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalPlanPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService, infrastructurePersistenceModule],
})
export class PlansModule {}
