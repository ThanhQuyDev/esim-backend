import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Bounds for a code a partner names themselves (#028). */
export const PARTNER_COUPON_CODE_MIN_LENGTH = 6;
export const PARTNER_COUPON_CODE_MAX_LENGTH = 20;

/**
 * A discount a partner funds out of their own commission (#028).
 *
 * Whatever they give the customer is taken from what they would have earned:
 * the share kept plus the share given always adds up to the original
 * commission, never more — which is why `discountPercent` is capped at the
 * partner's own rate.
 */
export class CreatePartnerCouponDto {
  @ApiProperty({ example: 'VANA2026' })
  @IsString()
  @IsNotEmpty()
  @MinLength(PARTNER_COUPON_CODE_MIN_LENGTH)
  @MaxLength(PARTNER_COUPON_CODE_MAX_LENGTH)
  @Matches(/^[A-Za-z0-9]+$/, {
    message: 'Mã giảm giá chỉ gồm chữ và số, không dấu và không khoảng trắng.',
  })
  code!: string;

  @ApiProperty({ example: 5, description: 'Phần trăm giảm trên giá trị đơn' })
  @IsNumber()
  @Min(1)
  @Max(100)
  discountPercent!: number;

  @ApiPropertyOptional({ example: 50000, description: 'Mức giảm tối đa (VND)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({
    example: 500000,
    description: 'Giá trị đơn tối thiểu (VND)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ example: '2026-12-31T16:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 100, description: 'Tổng lượt dùng tối đa' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsage?: number;

  @ApiPropertyOptional({ example: 1, description: 'Số lượt dùng mỗi khách' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsagePerUser?: number;
}
