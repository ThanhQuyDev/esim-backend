import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Coerce stringified numbers (e.g. "0.4000", "12.50") into real numbers so
 * the @IsNumber validator passes. Empty / null / undefined values are passed
 * through untouched. Anything that fails Number() coercion is also passed
 * through so @IsNumber surfaces a meaningful "must be a number" error.
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

export class CreatePlanDto {
  @ApiProperty({ example: 'esimaccess', type: String })
  @IsNotEmpty()
  @IsString()
  provider: string;

  @ApiProperty({ example: 'CKH002', type: String })
  @IsNotEmpty()
  @IsString()
  providerPlanId: string;

  @ApiProperty({ example: 'Spain 3GB 30Days', type: String })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'esimaccess-CKH002', type: String })
  @IsNotEmpty()
  @IsString()
  slug: string;

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

  @ApiProperty({ example: 30, type: Number })
  @Transform(toNumber)
  @IsNotEmpty()
  @IsNumber()
  durationDays: number;

  @ApiProperty({ example: 3072, type: Number })
  @Transform(toNumber)
  @IsNotEmpty()
  @IsNumber()
  dataMb: number;

  @ApiProperty({ example: 1.1, type: Number })
  @Transform(toNumber)
  @IsNotEmpty()
  @IsNumber()
  costPrice: number;

  @ApiProperty({ example: 1.43, type: Number })
  @Transform(toNumber)
  @IsNotEmpty()
  @IsNumber()
  price: number;

  @ApiProperty({ example: 4.5, type: Number })
  @Transform(toNumber)
  @IsNotEmpty()
  @IsNumber()
  retailPrice: number;

  @ApiProperty({ example: 'USD', type: String })
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiPropertyOptional({ example: 'data-in-total', type: String })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    example: 100,
    type: Number,
    description: 'Number of SMS included',
  })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  sms?: number | null;

  @ApiPropertyOptional({
    example: 50,
    type: Number,
    description: 'Call minutes included',
  })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  call?: number | null;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  topUp?: boolean;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '4G,5G', type: String })
  @IsOptional()
  @IsString()
  speed?: string | null;

  @ApiPropertyOptional({ example: 'Viettel,Mobifone', type: String })
  @IsOptional()
  @IsString()
  operatorName?: string | null;

  @ApiPropertyOptional({ example: '1 Mbps', type: String })
  @IsOptional()
  @IsString()
  fupSpeed?: string | null;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isAbleMultidate?: boolean;

  @ApiPropertyOptional({
    example: 0,
    type: Number,
    description: 'Discount percentage (0-100)',
  })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isKyc?: boolean;

  @ApiPropertyOptional({
    example: false,
    type: Boolean,
    description: 'True if esims are served from local inventory',
  })
  @IsOptional()
  @IsBoolean()
  isLocalInventory?: boolean;

  @ApiPropertyOptional({ example: 'internet', type: String })
  @IsOptional()
  @IsString()
  apn?: string | null;

  @ApiPropertyOptional({
    example: true,
    type: Boolean,
    description: 'Hotspot supported',
  })
  @IsOptional()
  @IsBoolean()
  hotSpot?: boolean;

  @ApiPropertyOptional({
    example: '5GB',
    type: String,
    description: 'Hotspot data allowance (e.g. "5GB", "2GB")',
  })
  @IsOptional()
  @IsString()
  hotSpotAllow?: string | null;

  @ApiPropertyOptional({
    example: 45000,
    type: Number,
    description: 'Price in VND (set directly for VND currency plans)',
  })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  vndPrice?: number;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  lastSyncedAt?: Date | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['popular', 'best seller'],
    description: 'Tags: popular, best seller, new, hot deal',
  })
  @IsOptional()
  tags?: string[] | null;
}
