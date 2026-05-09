import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCartItemDto {
  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @IsNumber()
  planId: number;

  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 7,
    description: 'Number of days for multidate plans',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  periodNum?: number;
}
