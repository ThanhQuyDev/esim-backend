import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateProfitMarginTierDto {
  @ApiProperty({
    example: 0,
    type: Number,
    description: 'Min VND price (inclusive)',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  minVnd: number;

  @ApiProperty({
    example: 100000,
    type: Number,
    description: 'Max VND price (inclusive)',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  maxVnd: number;

  @ApiProperty({ example: 30.0, type: Number })
  @IsNotEmpty()
  @IsNumber()
  percentage: number;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
