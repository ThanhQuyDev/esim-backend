import { Module } from '@nestjs/common';
import { ManufacturerNotesService } from './manufacturer-notes.service';
import { ManufacturerNotesController } from './manufacturer-notes.controller';
import { RelationalManufacturerNotePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalManufacturerNotePersistenceModule],
  controllers: [ManufacturerNotesController],
  providers: [ManufacturerNotesService],
  exports: [
    ManufacturerNotesService,
    RelationalManufacturerNotePersistenceModule,
  ],
})
export class ManufacturerNotesModule {}
