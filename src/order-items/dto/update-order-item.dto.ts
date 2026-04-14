import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateOrderItemDto } from './create-order-item.dto';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderItemDto extends PartialType(CreateOrderItemDto) {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  orderId?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  planId?: number;

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

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ type: Number, example: 9.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  price?: number;

  @ApiPropertyOptional({ example: 'USD', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;
}
