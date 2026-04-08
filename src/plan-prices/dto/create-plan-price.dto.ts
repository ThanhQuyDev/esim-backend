import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePlanPriceDto {
  @ApiProperty({ example: 1, type: Number })
  @IsNotEmpty()
  @IsNumber()
  planId: number;

  @ApiProperty({ example: 'USD', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(3)
  currency: string;

  @ApiProperty({ example: 9.99, type: Number })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  price: number;

  @ApiPropertyOptional({ example: 14.99, type: Number })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  originalPrice?: number | null;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
