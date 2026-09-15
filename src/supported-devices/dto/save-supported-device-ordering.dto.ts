import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ManufacturerOrderItemDto {
  @ApiProperty({ example: 'Apple' })
  @IsString()
  @MinLength(1)
  manufacturer: string;

  /** 0 = not numbered (listed after numbered brands, A–Z). */
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  manufacturerOrder: number;
}

export class DeviceOrderItemDto {
  @ApiProperty({ example: '8b2f0f5e-0000-4000-8000-000000000000' })
  @IsUUID()
  id: string;

  /** 0 = not numbered (listed after numbered models, A–Z). */
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

/** Bulk brand / model positions from the CMS ordering screen (#047). */
export class SaveSupportedDeviceOrderingDto {
  @ApiProperty({ type: [ManufacturerOrderItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ManufacturerOrderItemDto)
  manufacturers?: ManufacturerOrderItemDto[];

  @ApiProperty({ type: [DeviceOrderItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => DeviceOrderItemDto)
  devices?: DeviceOrderItemDto[];
}
