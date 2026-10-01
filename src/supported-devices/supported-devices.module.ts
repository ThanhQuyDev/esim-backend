import { Module } from '@nestjs/common';
import { SupportedDevicesService } from './supported-devices.service';
import { SupportedDevicesController } from './supported-devices.controller';
import { RelationalSupportedDevicePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { ManufacturerNotesModule } from '../manufacturer-notes/manufacturer-notes.module';

@Module({
  // The grouped device list carries each brand's extra note (#079).
  imports: [
    RelationalSupportedDevicePersistenceModule,
    ManufacturerNotesModule,
  ],
  controllers: [SupportedDevicesController],
  providers: [SupportedDevicesService],
  exports: [SupportedDevicesService],
})
export class SupportedDevicesModule {}
