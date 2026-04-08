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

  @ApiProperty({ example: 3.0, type: Number })
  @IsNotEmpty()
  @IsNumber()
  dataGb: number;

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
}
