import { Module } from '@nestjs/common';
import { SupportedDevicesService } from './supported-devices.service';
import { SupportedDevicesController } from './supported-devices.controller';
import { RelationalSupportedDevicePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalSupportedDevicePersistenceModule],
  controllers: [SupportedDevicesController],
  providers: [SupportedDevicesService],
  exports: [SupportedDevicesService],
})
export class SupportedDevicesModule {}
