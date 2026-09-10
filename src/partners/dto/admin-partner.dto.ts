import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PARTNER_DEPOSIT_MIN_VND,
  PARTNER_PAYOUT_MIN_VND,
} from '../partners.constants';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PartnerStatusEnum } from '../partners.enum';

export class RejectPartnerDto {
  @ApiProperty({ example: 'Thông tin doanh nghiệp chưa đầy đủ' })
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class UpdatePartnerStatusDto {
  @ApiProperty({ enum: PartnerStatusEnum })
  @IsEnum(PartnerStatusEnum)
  status!: PartnerStatusEnum;
}

export class AssignPartnerTierDto {
  @ApiProperty({ example: 'SILVER' })
  @IsString()
  @MaxLength(50)
  tierCode!: string;
}

export class AdjustPartnerWalletDto {
  @ApiProperty({ type: Number, example: 500000 })
  @IsInt()
  amountVnd!: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ConfirmDepositRequestDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ProcessPartnerPayoutDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export class CreateDepositRequestDto {
  @ApiProperty({ type: Number, example: 5000000 })
  @IsInt()
  @Min(PARTNER_DEPOSIT_MIN_VND)
  amountVnd!: number;
}

export class CreatePartnerPayoutDto {
  @ApiProperty({ type: Number, example: 200000 })
  @IsInt()
  @Min(PARTNER_PAYOUT_MIN_VND)
  amountVnd!: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bankAccountInfo?: string;
}
