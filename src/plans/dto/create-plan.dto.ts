import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

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
  @IsOptional()
  @IsNumber()
  destinationId?: number | null;

  @ApiPropertyOptional({ example: 1, type: Number })
  @IsOptional()
  @IsNumber()
  regionId?: number | null;

  @ApiProperty({ example: 30, type: Number })
  @IsNotEmpty()
  @IsNumber()
  durationDays: number;

  @ApiProperty({ example: 3072, type: Number })
  @IsNotEmpty()
  @IsNumber()
  dataMb: number;

  @ApiProperty({ example: 1.1, type: Number })
  @IsNotEmpty()
  @IsNumber()
  costPrice: number;

  @ApiProperty({ example: 1.43, type: Number })
  @IsNotEmpty()
  @IsNumber()
  price: number;

  @ApiProperty({ example: 4.5, type: Number })
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
  @IsOptional()
  @IsNumber()
  discount?: number;

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
