import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OrderRefundModeEnum, WalletStatusEnum } from '../wallets.enum';

export class AdminWalletQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;
}

export class ManualWalletAdjustDto {
  @ApiProperty({ type: Number, example: 10000 })
  @IsInt()
  amountVnd!: number;

  @ApiPropertyOptional({ type: String, example: 'Manual correction' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateWalletStatusDto {
  @ApiProperty({ enum: WalletStatusEnum })
  @IsEnum(WalletStatusEnum)
  status!: WalletStatusEnum;
}

export class UpdateReferralCodeDto {
  @ApiProperty({ type: String, example: 'MYCODE1234' })
  @IsString()
  code!: string;
}

/** Admin edit of a customer's referral code — any length from 3 to 50 (#026). */
export class AdminUpdateReferralCodeDto {
  @ApiProperty({ type: String, example: 'VIP' })
  @IsString()
  @MaxLength(50)
  code!: string;
}

export class RefundOrderDto {
  @ApiProperty({ enum: OrderRefundModeEnum })
  @IsEnum(OrderRefundModeEnum)
  mode!: OrderRefundModeEnum;

  @ApiProperty({ type: Number, example: 90000 })
  @IsInt()
  @Min(1)
  amountVnd!: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  adminNote?: string;

  /**
   * Refund only these order items (#027). An order can mix suppliers, and only
   * some of them refund — e.g. esimaccess and gadgetkorea do, airalo does not.
   * When given, only these items are cancelled with their supplier and marked
   * refunded; the rest of the order is left alone. Omit to refund the order as
   * a whole, as before.
   */
  @ApiPropertyOptional({ type: [Number], example: [12, 13] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  orderItemIds?: number[];
}
