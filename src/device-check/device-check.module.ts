import { Module } from '@nestjs/common';
import { DeviceCheckController } from './device-check.controller';

/** QR hand-off for the supported-devices page (vande-2011 #031). */
@Module({ controllers: [DeviceCheckController] })
export class DeviceCheckModule {}
