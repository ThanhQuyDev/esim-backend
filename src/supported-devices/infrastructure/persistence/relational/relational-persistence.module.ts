import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportedDeviceEntity } from './entities/supported-device.entity';
import { SupportedDeviceRepository } from '../supported-device.repository';
import { SupportedDeviceRelationalRepository } from './repositories/supported-device.repository';

@Module({
  imports: [TypeOrmModule.forFeature([SupportedDeviceEntity])],
  providers: [
    {
      provide: SupportedDeviceRepository,
      useClass: SupportedDeviceRelationalRepository,
    },
  ],
  exports: [SupportedDeviceRepository],
})
export class RelationalSupportedDevicePersistenceModule {}
