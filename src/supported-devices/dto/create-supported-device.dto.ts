import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
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

  /** Brand position; 0 keeps the brand alphabetical (#090). */
  @ApiProperty({ required: false, type: Number, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  manufacturerOrder?: number;

  /** Model position inside the brand; 0 keeps it alphabetical (#090). */
  @ApiProperty({ required: false, type: Number, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
