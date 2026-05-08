import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/domain/user';

export class Order {
  @ApiProperty({
    type: Number,
  })
  id!: number;

  @ApiProperty({
    type: Number,
  })
  userId!: number;

  @ApiProperty({
    type: () => User,
  })
  user?: User;

  @ApiProperty({
    type: String,
    example: 'ORD-20260403-001',
  })
  orderNumber!: string;

  @ApiProperty({
    type: String,
    example: 'pending',
  })
  status!: string;

  @ApiProperty({
    type: Number,
    example: 99.99,
  })
  totalAmount!: number;

  @ApiProperty({
    type: String,
    example: 'USD',
  })
  currency!: string;

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
  discountAmount!: number;

  @ApiProperty({ type: Number, example: 450000, description: 'Total in VND' })
  vndPrice!: number;

  @ApiProperty({
    type: Number,
    example: 300000,
    description: 'Cost price in VND at time of purchase',
  })
  vndCostPrice!: number;

  @ApiProperty({ type: Number, example: 450000 })
  subtotalVndPrice!: number;

  @ApiProperty({ type: Number, example: 0 })
  couponDiscountVndAmount!: number;

  @ApiPropertyOptional({ type: String, example: 'EXU123ABC' })
  referralCode?: string | null;

  @ApiPropertyOptional({ type: Number })
  referrerUserId?: number | null;

  @ApiProperty({ type: Number, example: 0 })
  referralDiscountVndAmount!: number;

  @ApiProperty({ type: Number, example: 0 })
  walletSpentVndAmount!: number;

  @ApiProperty({ type: Number, example: 450000 })
  payableVndPrice!: number;

  @ApiProperty({ type: Number, example: 9000 })
  cashbackAmountVnd!: number;

  @ApiPropertyOptional({ type: Number })
  cashbackTransactionId?: number | null;

  @ApiPropertyOptional({ type: Date })
  cashbackReversedAt?: Date | null;

  @ApiPropertyOptional({ type: String })
  refundStatus?: string | null;

  @ApiProperty({ type: Number, example: 0 })
  refundedAmountVnd!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  deletedAt!: Date;
}
