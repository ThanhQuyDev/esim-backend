import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CreatePlanDto } from './create-plan.dto';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * Coerce stringified numbers ("0.4000", "12.50") into real numbers.
 * Mirrors the helper in create-plan.dto.ts so the admin grid and Excel
 * imports can post decimal-string fields without tripping @IsNumber.
 */
const toNumber = ({ value }: { value: unknown }): unknown => {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return value;
    const n = Number(trimmed);
    return Number.isNaN(n) ? value : n;
  }
  return value;
};

export class UpdatePlanDto extends PartialType(CreatePlanDto) {
  @ApiPropertyOptional({ example: 'esimaccess', type: String })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ example: 'CKH002', type: String })
  @IsOptional()
  @IsString()
  providerPlanId?: string;

  @ApiPropertyOptional({ example: 'Spain 3GB 30Days', type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'esimaccess-CKH002', type: String })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 'ES', type: String })
  @IsOptional()
  @IsString()
  countryCode?: string | null;

  @ApiPropertyOptional({ example: 1, type: Number })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  destinationId?: number | null;

  @ApiPropertyOptional({ example: 1, type: Number })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  regionId?: number | null;

  @ApiPropertyOptional({ example: 30, type: Number })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @ApiPropertyOptional({ example: 3072, type: Number })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  dataMb?: number;

  @ApiPropertyOptional({ example: 1.1, type: Number })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @ApiPropertyOptional({ example: 1.43, type: Number })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 4.5, type: Number })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  retailPrice?: number;

  @ApiPropertyOptional({ example: 'USD', type: String })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'data-in-total', type: String })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  topUp?: boolean;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isKyc?: boolean;

  @ApiPropertyOptional({ example: 'internet', type: String })
  @IsOptional()
  @IsString()
  apn?: string | null;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  lastSyncedAt?: Date | null;
}
