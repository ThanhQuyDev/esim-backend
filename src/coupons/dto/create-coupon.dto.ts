import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { COUPON_DISCOUNT_TYPES, CouponDiscountType } from '../coupon-discount';

export class CreateCouponDto {
  @ApiProperty({ type: String, example: 'SUMMER10' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ type: Number, example: 10, description: '0-100' })
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent: number;

  /** How the discount is worked out — a percentage or a flat sum (#082). */
  @ApiPropertyOptional({
    enum: COUPON_DISCOUNT_TYPES,
    default: 'percent',
  })
  @IsOptional()
  @IsIn(COUPON_DISCOUNT_TYPES)
  discountType?: CouponDiscountType;

  /** Flat VND off, used when `discountType` is 'fixed'. */
  @ApiPropertyOptional({ type: Number, example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  /** Ceiling for a percentage code ("15% off, up to 50k"). */
  @ApiPropertyOptional({ type: Number, example: 50000, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number | null;

  @ApiPropertyOptional({ type: Number, example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsage?: number | null;

  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsagePerUser?: number | null;

  @ApiPropertyOptional({ type: Number, example: 5.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number | null;

  @ApiPropertyOptional({ type: String, example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  /** Listed on the cart page; a private code still works when typed (#081). */
  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    type: Number,
    description: 'Partner (KOL) owning this code; null for house-wide coupons.',
  })
  @IsOptional()
  @IsInt()
  partnerId?: number | null;
}
