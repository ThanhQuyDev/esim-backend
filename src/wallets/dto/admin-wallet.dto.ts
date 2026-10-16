import {
  AIRALO_REFUND_REASONS,
  AiraloRefundReason,
} from '../../esim-providers/airalo/airalo-refund';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
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

  /**
   * Refund single eSIMs (ICCIDs) out of a line bought in several copies (#008,
   * test round 4) — the customer who ordered 3 for 2 people gets the spare one
   * back without cancelling the other two. Each counts at its line's unit
   * price. Can be combined with `orderItemIds`; an eSIM of a line that is
   * refunded whole is simply part of that line.
   */
  @ApiPropertyOptional({ type: [Number], example: [101] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  esimIds?: number[];

  /**
   * Also ask Airalo to refund the Airalo eSIMs being refunded, for this
   * reason (doitac-1410 #079). Omit to refund the customer only.
   */
  @ApiPropertyOptional({ enum: AIRALO_REFUND_REASONS })
  @IsOptional()
  @IsIn(AIRALO_REFUND_REASONS as unknown as string[])
  airaloRefundReason?: AiraloRefundReason;
}
