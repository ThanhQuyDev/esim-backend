import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  IsDateString,
  IsNumber,
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

/** "Không cần ký quỹ" + "Hạn mức giao dịch" for one partner (vande #056). */
export class UpdatePartnerCreditLimitDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  noDepositRequired!: boolean;

  @ApiPropertyOptional({ example: 100000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000_000)
  creditLimitVnd?: number;
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

/** One line of the contract details shown in the reconciliation file (#061). */
export class PartnerContractLineDto {
  @ApiProperty({ type: String, example: 'Số hợp đồng' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @ApiProperty({ type: String, example: 'HD-2026/014' })
  @IsString()
  @MaxLength(500)
  value!: string;
}

/** Everything an admin may edit on the partner detail screen (#061). */
export class UpdatePartnerProfileByAdminDto {
  @ApiPropertyOptional({ type: [PartnerContractLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PartnerContractLineDto)
  contractInfo?: PartnerContractLineDto[];

  @ApiPropertyOptional({
    type: Number,
    description:
      'Smallest top-up this partner may make; null falls back to the programme default (#061).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositMinVnd?: number | null;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositMaxVnd?: number | null;
}

/** Filters on the withdrawal list (#068). */
export class QueryPartnerPayoutDto {
  @ApiPropertyOptional({
    description: 'all | pending | approved | rejected | paid',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Tên, email, số điện thoại hoặc mã ID đối tác',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  /** "Kỳ tài chính" as `YYYY-MM` (doitac-1410 #057). */
  @ApiPropertyOptional({ example: '2026-10' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ type: Number, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/** "Hoàn tiền" on a distribution partner's order (doitac-1410 #058). */
export class AdminRefundPartnerPurchaseDto {
  @ApiPropertyOptional({ type: [String], description: 'ICCID cần hoàn' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  iccids?: string[];

  @ApiPropertyOptional({
    type: [Number],
    description: 'Hoàn cả sản phẩm (mọi eSIM của dòng)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Type(() => Number)
  @IsInt({ each: true })
  itemIds?: number[];

  @ApiProperty({ example: 'eSIM không kết nối được, nhà mạng xác nhận lỗi' })
  @IsString()
  @MinLength(5, { message: 'Vui lòng nhập lý do hoàn tiền (ít nhất 5 ký tự).' })
  @MaxLength(500)
  reason!: string;
}

/** "Từ chối" a deposit request (doitac-1410 #063). */
export class RejectDepositRequestDto {
  @ApiProperty({ example: 'Không nhận được tiền chuyển khoản với mã này' })
  @IsString()
  @MinLength(5, {
    message: 'Vui lòng nhập lý do từ chối (ít nhất 5 ký tự) để đối tác biết.',
  })
  @MaxLength(500)
  reason!: string;
}

/** "Duyệt chi" or "Từ chối" for the rows an admin ticked (#069). */
export class BulkPayoutDecisionDto {
  @ApiProperty({ type: [Number], example: [4, 7] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  ids!: number[];

  @ApiProperty({ example: 'approve', description: 'approve | reject' })
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @ApiPropertyOptional({
    type: String,
    maxLength: 1000,
    description: 'Bắt buộc khi từ chối — đối tác sẽ nhìn thấy lý do này.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

/** Compose an announcement to partners (#079). */
export class CreatePartnerNotificationDto {
  @ApiProperty({ example: 'Bảo trì hệ thống ngày 05/10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** HTML from the rich-text editor (doitac-1410 #062). */
  @ApiProperty({
    example: '<p>Hệ thống sẽ tạm dừng từ 01:00 đến 03:00 ngày 05/10.</p>',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100000)
  body!: string;

  @ApiPropertyOptional({
    example: 'all',
    description: 'all | kol | distribution — nhóm đối tác nhận thông báo.',
  })
  @IsOptional()
  @IsIn(['all', 'kol', 'distribution'])
  audience?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Gửi kèm email ngoài thông báo trong ứng dụng.',
  })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  /** Bình thường / Quan trọng / Khẩn cấp — the banner's colour (#062). */
  @ApiPropertyOptional({ enum: ['normal', 'important', 'urgent'] })
  @IsOptional()
  @IsIn(['normal', 'important', 'urgent'])
  priority?: string;

  /** "Nổi bật": shown at the top of the page (doitac-1410 #062). */
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

/** "Sửa" on a sent announcement (doitac-1410 #062): no email goes again. */
export class UpdatePartnerNotificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100000)
  body?: string;

  @ApiPropertyOptional({ enum: ['all', 'kol', 'distribution'] })
  @IsOptional()
  @IsIn(['all', 'kol', 'distribution'])
  audience?: string;

  @ApiPropertyOptional({ enum: ['normal', 'important', 'urgent'] })
  @IsOptional()
  @IsIn(['normal', 'important', 'urgent'])
  priority?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

/** The partner programme's settings (#075, #076, #077). */
export class UpdatePartnerProgramSettingDto {
  @ApiPropertyOptional({ type: Number, example: 50000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  payoutMinKolVnd?: number;

  @ApiPropertyOptional({ type: Number, example: 50000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  payoutMinDistributionVnd?: number;

  @ApiPropertyOptional({ type: Number, example: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositMinKolVnd?: number;

  @ApiPropertyOptional({ type: Number, example: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositMinDistributionVnd?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 500000,
    description: 'Dưới mức này thì cảnh báo đối tác phân phối nạp thêm (#077).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowDepositWarningVnd?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  reconciliationEmailEnabled?: boolean;

  @ApiPropertyOptional({
    type: Number,
    example: 5,
    description: 'Ngày trong tháng N+1 gửi đối soát tháng N (#076). Tối đa 28.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  reconciliationEmailDayOfMonth?: number;
}

/** Sign off (or hold) one or more reconciliation statements (#065). */
export class UpdateReconciliationStatusDto {
  @ApiProperty({ type: [Number], example: [12, 18] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  partnerIds!: number[];

  @ApiProperty({ example: '2026-09' })
  @IsString()
  @MaxLength(7)
  period!: string;

  @ApiProperty({
    example: 'approved',
    description: 'pending | reviewing | approved',
  })
  @IsIn(['pending', 'reviewing', 'approved'])
  status!: string;

  @ApiPropertyOptional({ type: String, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
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
  /**
   * Only "a positive whole number" here (vande #008). The limits that apply
   * are the partner's own or the programme's, checked in
   * `createDepositRequest` against `depositLimitsFor` — a fixed 100.000đ –
   * 10 triệu on the DTO turned away a 10.000đ top-up the admin had allowed
   * ("amountVnd must not be less than 100000"), and would refuse a ceiling
   * raised above 10 triệu the same way.
   */
  @ApiProperty({ type: Number, example: 5000000 })
  @IsInt()
  @Min(1)
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
  // Only "more than nothing" here: the real minimum is the one set in "Cấu
  // hình chung", checked in the service. A fixed floor here overruled an admin
  // who set it lower (doitac-1410 #010).
  @Min(1)
  amountVnd!: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bankAccountInfo?: string;
}

/** Freeze (`true`) or release the partner's wallet (doitac-1410 #004). */
export class UpdatePartnerWalletStatusDto {
  @ApiProperty({ type: Boolean, example: true })
  @IsBoolean()
  locked!: boolean;
}

/** A deposit promotion, as the admin sets it up (doitac-1410 #015). */
export class UpsertDepositPromotionDto {
  @ApiProperty({ example: 'Tặng 5% tháng 11' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  bonusPercent!: number;

  @ApiProperty({ example: 5_000_000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDepositVnd!: number;

  @ApiPropertyOptional({ example: 500_000, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxBonusVnd?: number | null;

  @ApiProperty({ example: '2026-11-01T00:00:00+07:00' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-11-30T23:59:59+07:00' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
