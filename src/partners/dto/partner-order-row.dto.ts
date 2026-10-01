import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One line of the order attributed to a partner (portal "Đơn hàng" screen). */
export class PartnerOrderItemDto {
  @ApiProperty({ type: String, example: 'Wintel 7GB/ngày' })
  planName!: string;

  @ApiProperty({ type: Number, example: 2 })
  quantity!: number;

  /** Line price, so the partner can read the order without opening it (#023). */
  @ApiPropertyOptional({ type: Number, example: 590000 })
  vndPrice?: number;

  /** This product came back; the row is greyed and labelled (#023). */
  @ApiPropertyOptional({ type: Boolean })
  refunded?: boolean;
}

/**
 * An order the partner earned (or will earn) commission on. Read model only —
 * the partner never sees the buyer's identity, just what was bought.
 */
export class PartnerOrderRowDto {
  @ApiProperty({ type: String, example: 'ORD-260925210805694-NZ7UEC' })
  orderNumber!: string;

  @ApiProperty({ type: String, example: 'paid' })
  status!: string;

  /** Whose order this is — only interesting on the admin's list (#071). */
  @ApiProperty({ type: Number, example: 14 })
  partnerId!: number;

  @ApiProperty({ type: String, nullable: true, example: 'Nguyễn Văn A' })
  partnerName!: string | null;

  @ApiProperty({ type: Number, example: 290000 })
  /** Revenue after refunds — what this order is actually worth now (#018). */
  vndPrice!: number;

  @ApiProperty({ required: false })
  grossVndPrice?: number;

  /** How much of the order the customer got back (#018). */
  @ApiProperty({ required: false })
  refundedVnd?: number;

  /** Rate this order paid, read back from the money (#026). */
  @ApiPropertyOptional({ type: Number, example: 15 })
  commissionPercent?: number | null;

  /** Discount code the order came in on, when it was not a link (#024). */
  @ApiPropertyOptional({ type: String })
  couponCode?: string | null;

  /** Whether esim.vn had seen this buyer before this order (#021). */
  @ApiProperty({ required: false, enum: ['new', 'returning'] })
  customerType?: 'new' | 'returning';

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ type: Number, example: 29000, nullable: true })
  commissionVnd!: number | null;

  @ApiPropertyOptional({ type: String, example: 'credited', nullable: true })
  commissionStatus!: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'TMBCX1IU',
    nullable: true,
    description: 'Marketing link the order was attributed to.',
  })
  linkCode!: string | null;

  @ApiProperty({ type: Number, example: 5, description: 'eSIMs provisioned.' })
  esimCount!: number;

  @ApiProperty({ type: [PartnerOrderItemDto] })
  items!: PartnerOrderItemDto[];

  @ApiProperty({
    type: String,
    enum: ['valid', 'pending', 'invalid'],
    example: 'valid',
    description:
      'Whether this order counts towards commission (#095). `pending` is an order still on its way — paid but not reconciled, or not paid yet.',
  })
  validity!: PartnerOrderValidity;

  @ApiPropertyOptional({
    type: String,
    enum: [
      'self_referral',
      'order_cancelled',
      'commission_reversed',
      'no_commission',
    ],
    nullable: true,
    description: 'Why an invalid order earned nothing.',
  })
  invalidReason!: PartnerOrderInvalidReason | null;
}

export type PartnerOrderValidity = 'valid' | 'pending' | 'invalid';

export type PartnerOrderInvalidReason =
  /** The partner bought through their own link (#095). */
  'self_referral' | 'order_cancelled' | 'commission_reversed' | 'no_commission';
