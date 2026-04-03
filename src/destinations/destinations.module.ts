import { Module } from '@nestjs/common';
import { DestinationsController } from './destinations.controller';
import { DestinationsService } from './destinations.service';
import { RelationalDestinationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalDestinationPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [DestinationsController],
  providers: [DestinationsService],
  exports: [DestinationsService, infrastructurePersistenceModule],
})
export class DestinationsModule {}
