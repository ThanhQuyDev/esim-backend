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
      'Page size. Defaults to 10. Server caps at 200 to keep the admin grid responsive.',
  })
  @Transform(({ value }) => toPositiveInt(value, 10))
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  /**
   * One or more device types, comma-separated (#052). The CMS filter is a
   * multi-select, and a single value used to be compared with `=` — so picking two
   * types matched nothing at all.
   */
  @ApiPropertyOptional({
    enum: DeviceType,
    isArray: true,
    description: 'Comma-separated list, e.g. "Tablets,Laptops"',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const raw: unknown[] = Array.isArray(value)
      ? value
      : String(value ?? '').split(',');
    const cleaned = raw.map((entry) => String(entry).trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  })
  @IsEnum(DeviceType, { each: true })
  type?: DeviceType[];

  /** Nhà sản xuất, from the CMS filter's select box (#052). */
  @ApiPropertyOptional({ description: 'Exact manufacturer name' })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional({ description: 'Search by device name' })
  @IsOptional()
  @IsString()
  search?: string;
}
