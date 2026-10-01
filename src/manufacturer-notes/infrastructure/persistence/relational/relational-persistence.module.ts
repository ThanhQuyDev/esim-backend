import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManufacturerNoteRepository } from '../manufacturer-note.repository';
import { ManufacturerNoteRelationalRepository } from './repositories/manufacturer-note.repository';
import { ManufacturerNoteEntity } from './entities/manufacturer-note.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ManufacturerNoteEntity])],
  providers: [
    {
      provide: ManufacturerNoteRepository,
      useClass: ManufacturerNoteRelationalRepository,
    },
  ],
  exports: [ManufacturerNoteRepository],
})
export class RelationalManufacturerNotePersistenceModule {}
