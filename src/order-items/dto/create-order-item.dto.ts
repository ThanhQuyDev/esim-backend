import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @IsNumber()
  orderId: number;

  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @IsNumber()
  planId: number;

  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @IsNumber()
  planPriceId: number;

  @ApiProperty({ type: Number, example: 9.99 })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  price: number;

  @ApiProperty({ example: 'USD', type: String })
  @IsNotEmpty()
  @IsString()
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;
}
