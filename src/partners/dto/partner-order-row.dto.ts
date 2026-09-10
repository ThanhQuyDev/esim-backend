import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One line of the order attributed to a partner (portal "Đơn hàng" screen). */
export class PartnerOrderItemDto {
  @ApiProperty({ type: String, example: 'Wintel 7GB/ngày' })
  planName!: string;

  @ApiProperty({ type: Number, example: 2 })
  quantity!: number;
}

/**
 * An order the partner earned (or will earn) commission on. Read model only —
 * the partner never sees the buyer's identity, just what was bought.
 */
export class PartnerOrderRowDto {
  @ApiProperty({ type: String, example: 'ORD-1788909565715-U13KQW' })
  orderNumber!: string;

  @ApiProperty({ type: String, example: 'paid' })
  status!: string;

  @ApiProperty({ type: Number, example: 290000 })
  vndPrice!: number;

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
