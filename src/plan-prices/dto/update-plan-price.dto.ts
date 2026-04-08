import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePlanPriceDto } from './create-plan-price.dto';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePlanPriceDto extends PartialType(CreatePlanPriceDto) {
  @ApiPropertyOptional({ example: 1, type: Number })
  @IsOptional()
  @IsNumber()
  planId?: number;

  @ApiPropertyOptional({ example: 'USD', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 9.99, type: Number })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  price?: number;

  @ApiPropertyOptional({ example: 14.99, type: Number })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  originalPrice?: number | null;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
