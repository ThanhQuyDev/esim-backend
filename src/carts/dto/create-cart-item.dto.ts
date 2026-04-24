import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

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
}
