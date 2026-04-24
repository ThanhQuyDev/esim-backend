import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '../../plans/domain/plan';

const idType = Number;

export class OrderItem {
  @ApiProperty({ type: idType })
  id: number;

  @ApiProperty({ type: idType })
  orderId: number;

  @ApiProperty({ type: idType })
  planId: number;

  @ApiPropertyOptional({ type: () => Plan })
  plan?: Plan;

  @ApiPropertyOptional({ type: String })
  orderRequestId: string | null;

  @ApiPropertyOptional({ type: String })
  providerOrderId: string | null;

  @ApiPropertyOptional({ type: String })
  providerOrderCode: string | null;

  @ApiProperty({ type: String, example: 'pending' })
  status: string;

  @ApiProperty({ type: Number, example: 9.99 })
  price: number;

  @ApiProperty({ type: String, example: 'USD' })
  currency: string;

  @ApiProperty({ type: Number, example: 1 })
  quantity: number;

  @ApiProperty({ type: Number, example: 450000, description: 'Price in VND' })
  vndPrice: number;

  @ApiProperty({
    type: Number,
    example: 300000,
    description: 'Cost price in VND at time of purchase',
  })
  vndCostPrice: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
