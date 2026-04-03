import { Module } from '@nestjs/common';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';
import { RelationalRegionPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalRegionPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [RegionsController],
  providers: [RegionsService],
  exports: [RegionsService, infrastructurePersistenceModule],
})
export class RegionsModule {}
