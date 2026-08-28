import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
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
}
