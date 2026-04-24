import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Esim } from '../../esims/domain/esim';

export class UserOrderItemDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  planId: number;

  @ApiPropertyOptional({ type: String })
  orderRequestId: string | null;

  @ApiProperty({ type: String, example: 'pending' })
  status: string;

  @ApiProperty({ type: Number, example: 450000 })
  vndPrice: number;

  @ApiProperty({ type: Number, example: 1 })
  quantity: number;

  @ApiPropertyOptional({ type: () => [Esim] })
  esims?: Esim[];
}

export class UserOrderDetailDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  orderNumber: string;

  @ApiProperty({ type: String, example: 'pending' })
  status: string;

  @ApiProperty({ type: Number, example: 450000 })
  vndPrice: number;

  @ApiPropertyOptional({ type: String })
  paymentMethod?: string | null;

  @ApiPropertyOptional({ type: String })
  couponCode?: string | null;

  @ApiProperty({ type: () => [UserOrderItemDto] })
  items: UserOrderItemDto[];

  @ApiProperty()
  createdAt: Date;
}
