import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Order {
  @ApiProperty({
    type: Number,
  })
  id!: number;

  @ApiProperty({
    type: Number,
  })
  userId!: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Email of the buyer',
  })
  userEmail?: string | null;

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
    type: String,
    example: 'BUY_NEW',
    enum: ['BUY_NEW', 'TOPUP'],
  })
  orderType!: string;

  @ApiPropertyOptional({
    type: String,
    example: '89852245280001354019',
    description: 'For TOPUP orders, the iccid being topped up',
  })
  targetIccid?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'AIRALO',
  })
  topupProvider?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'bonbon-mobile-30days-3gb-topup',
  })
  topupPackageId?: string | null;

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

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Whether this order has an invoice request',
  })
  isInvoice?: boolean;

  @ApiPropertyOptional({
    type: Number,
    description: 'Number of order items',
  })
  itemCount?: number;
}
