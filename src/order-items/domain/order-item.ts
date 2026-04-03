import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '../../plans/domain/plan';
import { PlanPrice } from '../../plan-prices/domain/plan-price';

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

  @ApiProperty({ type: idType })
  planPriceId: number;

  @ApiPropertyOptional({ type: () => PlanPrice })
  planPrice?: PlanPrice;

  @ApiProperty({ type: Number, example: 9.99 })
  price: number;

  @ApiProperty({ type: String, example: 'USD' })
  currency: string;

  @ApiProperty({ type: Number, example: 1 })
  quantity: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
