import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '../../plans/domain/plan';

export type CartPlan = Omit<Plan, 'costPrice' | 'price' | 'retailPrice'>;

export class Cart {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  userId: number;

  @ApiProperty({ type: Number })
  planId: number;

  @ApiPropertyOptional()
  plan?: CartPlan;

  @ApiProperty({ type: Number, example: 1 })
  quantity: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
