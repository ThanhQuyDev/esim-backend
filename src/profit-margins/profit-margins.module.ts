import { Module } from '@nestjs/common';
import { ProfitMarginsController } from './profit-margins.controller';
import { ProfitMarginsService } from './profit-margins.service';
import { RelationalProfitMarginPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalProfitMarginPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [ProfitMarginsController],
  providers: [ProfitMarginsService],
  exports: [ProfitMarginsService, infrastructurePersistenceModule],
})
export class ProfitMarginsModule {}
