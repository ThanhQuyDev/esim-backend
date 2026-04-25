import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { DeviceType } from '../domain/supported-device';

export class CreateSupportedDeviceDto {
  @ApiProperty({
    required: true,
    type: () => String,
    example: 'iPhone 17 Pro Max',
  })
  @IsString()
  device: string;

  @ApiProperty({ required: true, type: () => String, example: 'Apple' })
  @IsString()
  manufacturer: string;

  @ApiProperty({
    required: true,
    enum: DeviceType,
    example: DeviceType.SMART_PHONES,
  })
  @IsEnum(DeviceType)
  type: DeviceType;
}
