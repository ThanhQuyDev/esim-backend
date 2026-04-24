import { Module, forwardRef } from '@nestjs/common';
import { ProfitMarginsController } from './profit-margins.controller';
import { ProfitMarginsService } from './profit-margins.service';
import { RelationalProfitMarginPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { PlansModule } from '../plans/plans.module';

const infrastructurePersistenceModule = RelationalProfitMarginPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule, forwardRef(() => PlansModule)],
  controllers: [ProfitMarginsController],
  providers: [ProfitMarginsService],
  exports: [ProfitMarginsService, infrastructurePersistenceModule],
})
export class ProfitMarginsModule {}
