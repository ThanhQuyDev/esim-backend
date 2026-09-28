import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PARTNER_DEPOSIT_MAX_VND,
  PARTNER_DEPOSIT_MIN_VND,
  PARTNER_PAYOUT_MIN_VND,
} from '../partners.constants';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PartnerStatusEnum, PartnerTopupMethodEnum } from '../partners.enum';

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

/** Admin ticks who may name their own marketing link (#014). */
export class UpdatePartnerLinkCodePermissionDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  canCustomLinkCode!: boolean;
}

/**
 * Change several partners' status at once (#059).
 *
 * The reason is required for a hold or a lock — those are the decisions someone
 * has to answer for later (#060).
 */
export class BulkPartnerStatusDto {
  @ApiProperty({ type: [Number], example: [12, 18] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  ids!: number[];

  @ApiProperty({ enum: PartnerStatusEnum })
  @IsEnum(PartnerStatusEnum)
  status!: PartnerStatusEnum;

  @ApiPropertyOptional({ type: String, example: 'Nghi ngờ gian lận đơn hàng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** An admin's own note on a partner (#056). */
export class UpdatePartnerAdminNoteDto {
  @ApiProperty({
    type: String,
    example: 'Đã gọi xác minh kênh bán, ảnh giấy phép hợp lệ.',
  })
  @IsString()
  @MaxLength(2000)
  adminNote!: string;
}

/** Tick/untick the affiliate grant for a distribution partner (#048). */
export class UpdatePartnerAffiliateGrantDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  canAffiliate!: boolean;
}

export class AdjustPartnerWalletDto {
  @ApiProperty({ type: Number, example: 500000 })
  @IsInt()
  amountVnd!: number;

  /**
   * Required (#060): the reason is what the partner reads in their transaction
   * history, and what an admin reads back a month later. Moving somebody's
   * money with nothing recorded is the gap the brief calls out — "hiện tại
   * không cần nhập lý do vẫn cho điều chỉnh thì chưa chặt chẽ".
   */
  @ApiProperty({
    type: String,
    example: 'Bù hoa hồng đơn DS-18342 đối soát thiếu',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
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
  @Max(PARTNER_DEPOSIT_MAX_VND)
  amountVnd!: number;

  @ApiPropertyOptional({
    enum: PartnerTopupMethodEnum,
    default: PartnerTopupMethodEnum.BANK_TRANSFER,
    description:
      'bank_transfer: SePay QR, credited in full. card: OnePay, with the gateway fee taken out of what is credited (#047).',
  })
  @IsOptional()
  @IsEnum(PartnerTopupMethodEnum)
  method?: PartnerTopupMethodEnum;
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
