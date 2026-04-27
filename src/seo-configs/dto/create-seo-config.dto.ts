import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSeoConfigDto {
  @ApiProperty({ type: String, example: '/destinations/japan' })
  @IsNotEmpty()
  @IsString()
  url: string;

  @ApiPropertyOptional({ type: String, example: 'Buy Japan eSIM - Best Plans' })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  ogTitle?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  ogDescription?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  destinationId?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  regionId?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  planId?: number;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
