import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponDiscountType } from '../coupon-discount';

export class Coupon {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, example: 'SUMMER10' })
  code: string;

  @ApiProperty({ type: Number, example: 10 })
  discountPercent: number;

  @ApiProperty({ type: String, enum: ['percent', 'fixed'], example: 'percent' })
  discountType: CouponDiscountType;

  @ApiProperty({
    type: Number,
    example: 50000,
    description: 'Flat VND off, when discountType is "fixed".',
  })
  discountAmount: number;

  @ApiPropertyOptional({
    type: Number,
    example: 50000,
    description: 'Ceiling for a percentage code; null means uncapped.',
  })
  maxDiscountAmount: number | null;

  @ApiPropertyOptional({ type: Number, example: 100 })
  maxUsage: number | null;

  @ApiPropertyOptional({ type: Number, example: 1 })
  maxUsagePerUser: number | null;

  @ApiProperty({ type: Number, example: 0 })
  usageCount: number;

  @ApiPropertyOptional({ type: Number, example: 5.0 })
  minOrderAmount: number | null;

  @ApiPropertyOptional({ type: Date })
  expiresAt: Date | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty({ type: Boolean, example: false })
  isPopular: boolean;

  @ApiProperty({
    type: Boolean,
    example: true,
    description:
      'Listed on the cart page. A private code still works when typed in.',
  })
  isPublic: boolean;

  @ApiPropertyOptional({
    type: Number,
    description: 'Partner (KOL) owning this code; null for house-wide coupons.',
  })
  partnerId?: number | null;

  @ApiPropertyOptional({
    type: String,
    description: "Owning partner's contact name, for display in listings.",
  })
  partnerName?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
