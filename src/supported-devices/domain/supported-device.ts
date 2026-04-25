import { ApiProperty } from '@nestjs/swagger';

export enum DeviceType {
  SMART_PHONES = 'Smart Phones',
  SMART_WATCHES = 'Smart Watches',
  TABLETS = 'Tablets',
  LAPTOPS = 'Laptops',
}

export class SupportedDevice {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  device: string;

  @ApiProperty({ type: String })
  manufacturer: string;

  @ApiProperty({ enum: DeviceType })
  type: DeviceType;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
