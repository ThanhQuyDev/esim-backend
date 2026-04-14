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

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  orderRequestId?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  providerOrderId?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  providerOrderCode?: string | null;

  @ApiPropertyOptional({ type: String, example: 'pending' })
  @IsOptional()
  @IsString()
  status?: string;

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
