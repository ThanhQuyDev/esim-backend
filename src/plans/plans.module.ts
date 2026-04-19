import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlansImportService } from './plans-import.service';
import { PlansEsimvnImportService } from './plans-esimvn-import.service';
import { RelationalPlanPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { DestinationsModule } from '../destinations/destinations.module';

const infrastructurePersistenceModule = RelationalPlanPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule, DestinationsModule],
  controllers: [PlansController],
  providers: [PlansService, PlansImportService, PlansEsimvnImportService],
  exports: [PlansService, infrastructurePersistenceModule],
})
export class PlansModule {}
