import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { DeviceType } from '../domain/supported-device';

const toPositiveInt = (value: unknown, fallback: number): number => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.floor(n);
};

export class FindAllSupportedDevicesDto {
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => toPositiveInt(value, 1))
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    default: 10,
    description:
      'Page size. Defaults to 10. Server caps at 100 to keep the admin grid responsive.',
  })
  @Transform(({ value }) => toPositiveInt(value, 10))
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: DeviceType })
  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;

  @ApiPropertyOptional({ description: 'Search by device name' })
  @IsOptional()
  @IsString()
  search?: string;
}
