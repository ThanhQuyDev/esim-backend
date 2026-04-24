import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/domain/user';

export class Order {
  @ApiProperty({
    type: Number,
  })
  id: number;

  @ApiProperty({
    type: Number,
  })
  userId: number;

  @ApiProperty({
    type: () => User,
  })
  user?: User;

  @ApiProperty({
    type: String,
    example: 'ORD-20260403-001',
  })
  orderNumber: string;

  @ApiProperty({
    type: String,
    example: 'pending',
  })
  status: string;

  @ApiProperty({
    type: Number,
    example: 99.99,
  })
  totalAmount: number;

  @ApiProperty({
    type: String,
    example: 'USD',
  })
  currency: string;

  @ApiPropertyOptional({
    type: String,
    example: 'credit_card',
  })
  paymentMethod?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'pi_3abc123',
  })
  paymentId?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'SUMMER10',
  })
  couponCode?: string | null;

  @ApiProperty({
    type: Number,
    example: 0,
  })
  discountAmount: number;

  @ApiProperty({ type: Number, example: 450000, description: 'Total in VND' })
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

  @ApiProperty()
  deletedAt: Date;
}
