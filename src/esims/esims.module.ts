import { Module } from '@nestjs/common';
import { EsimsController } from './esims.controller';
import { EsimsService } from './esims.service';
import { RelationalEsimPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalEsimPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [EsimsController],
  providers: [EsimsService],
  exports: [EsimsService, infrastructurePersistenceModule],
})
export class EsimsModule {}
