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

  @ApiProperty({
    type: Number,
    description: 'Brand position in the list; 0 keeps it alphabetical.',
  })
  manufacturerOrder: number;

  @ApiProperty({
    type: Number,
    description: 'Model position inside its brand; 0 keeps it alphabetical.',
  })
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
