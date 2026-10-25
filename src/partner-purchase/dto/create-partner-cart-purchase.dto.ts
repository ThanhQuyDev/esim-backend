import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class PartnerCartLineDto {
  @ApiProperty({ example: 123 })
  @Type(() => Number)
  @IsInt({ message: 'Gói không hợp lệ.' })
  @Min(1, { message: 'Gói không hợp lệ.' })
  planId!: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng phải từ 1 trở lên.' })
  quantity!: number;

  /**
   * Days of a day pass (eSIM Access: 1–365), vande #014. Without it a partner
   * could only buy one day. Ignored for fixed plans.
   */
  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ngày phải là số nguyên.' })
  @Min(1, { message: 'Số ngày phải từ 1 trở lên.' })
  @Max(365, { message: 'Tối đa 365 ngày.' })
  periodNum?: number;
}

/** The partner's cart, paid in one go (doitac-1410 #035). */
export class CreatePartnerCartPurchaseDto {
  @ApiProperty({ type: [PartnerCartLineDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Giỏ hàng đang trống.' })
  @ArrayMaxSize(50, { message: 'Mỗi lần thanh toán tối đa 50 gói.' })
  @ValidateNested({ each: true })
  @Type(() => PartnerCartLineDto)
  items!: PartnerCartLineDto[];

  @ApiPropertyOptional({ example: 'khach@example.com' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsEmail({}, { message: 'Email nhận eSIM không hợp lệ.' })
  recipientEmail?: string;

  /**
   * Part of a bulk upload (vande #057): `email` — the QR codes mailed spaced
   * `emailIntervalSec` apart; `file` — nothing mailed, a list to download.
   */
  @ApiPropertyOptional({ enum: ['email', 'file'] })
  @IsOptional()
  @IsIn(['email', 'file'])
  bulkMode?: 'email' | 'file';

  /** Shared by every checkout of one upload, so their emails queue together. */
  @ApiPropertyOptional({ example: 'b7f3c2a1-upload' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  bulkBatch?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  emailIntervalSec?: number;
}
