import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Bounds for a code a partner names themselves (#014). */
export const PARTNER_LINK_CODE_MIN_LENGTH = 8;
export const PARTNER_LINK_CODE_MAX_LENGTH = 50;
/** An admin may name a link from 2 characters (doitac-3010 #015). */
export const ADMIN_LINK_CODE_MIN_LENGTH = 2;

export class CreatePartnerLinkDto {
  @ApiProperty({ example: 'Chiến dịch TikTok tháng 9' })
  @IsString()
  @MaxLength(255)
  label!: string;

  @ApiPropertyOptional({
    example: 'VANA2026',
    description:
      'Referral code — letters, digits, "-", "_" or "."; 8 to 50 characters for a partner, from 2 for an admin; kept as typed, compared without case. Only partners an admin has allowed may send this; leave empty to have one generated.',
  })
  @IsOptional()
  @IsString()
  // 2 here, for an admin creating one; a partner's own needs 8 (the service).
  @MinLength(ADMIN_LINK_CODE_MIN_LENGTH, {
    message: `Mã giới thiệu cần từ ${ADMIN_LINK_CODE_MIN_LENGTH} ký tự trở lên.`,
  })
  @MaxLength(PARTNER_LINK_CODE_MAX_LENGTH, {
    message: `Mã giới thiệu tối đa ${PARTNER_LINK_CODE_MAX_LENGTH} ký tự.`,
  })
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      'Mã giới thiệu chỉ gồm chữ, số và các dấu "-", "_", ".", không dấu và không khoảng trắng.',
  })
  code?: string;

  @ApiPropertyOptional({
    example: '/khuyen-mai/sim-nhat-ban',
    description:
      'Path on esim.vn the link should redirect to. Defaults to homepage.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  targetPath?: string;
}

export class UpdatePartnerLinkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  targetPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** The link list's filters and order (doitac-1410 #018). */
export class QueryMyLinksDto {
  /** `live`: every link but the deleted, which have their own tab (#019). */
  @ApiPropertyOptional({
    enum: ['live', 'active', 'inactive', 'suspended', 'deleted'],
  })
  @IsOptional()
  @IsIn(['live', 'active', 'inactive', 'suspended', 'deleted'])
  status?: string;

  /** The `utm_source` the portal stores the channel as. */
  @ApiPropertyOptional({ example: 'youtube' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  channel?: string;

  /** The window the clicks, orders and commission are counted over. */
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-16' })
  @IsOptional()
  @IsString()
  to?: string;

  /** When the link was created. */
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({
    enum: ['updated', 'created', 'orders', 'commission', 'lastClick'],
  })
  @IsOptional()
  @IsIn(['updated', 'created', 'orders', 'commission', 'lastClick'])
  sort?: string;
}

/** An admin suspending or releasing one link (doitac-1410 #018). */
export class SetLinkSuspensionDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  suspended!: boolean;

  /** Told to the partner by email and notification, so it is required. */
  @ApiProperty({
    example: 'Link dẫn tới nội dung vi phạm chính sách quảng cáo',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

/** The ticket a partner opened to appeal a suspended link (doitac-1410 #018). */
export class AppealLinkDto {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  ticketId?: number;
}

/** Asking esim.vn to restore a deleted link (doitac-1410 #019). */
export class RequestLinkRestoreDto {
  @ApiProperty({ example: 'Link vẫn đang in trên tờ rơi phát ở sân bay' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

/** An admin deciding a restore request (doitac-1410 #019). */
/**
 * "Thay đổi trạng thái" for the ticked links (doitac-1410 #053). The reason is
 * required: it is what the partner reads in the link's "Lịch sử thay đổi".
 */
export class BulkLinkStatusDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Chưa chọn liên kết nào.' })
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  linkIds!: number[];

  @ApiProperty({ enum: ['suspend', 'unsuspend', 'restore'] })
  @IsIn(['suspend', 'unsuspend', 'restore'])
  action!: 'suspend' | 'unsuspend' | 'restore';

  /** "Ghi chú nội bộ" kept with each link, for admins only (doitac-1410 #055). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNote?: string;

  @ApiProperty({
    example: 'Link dẫn tới nội dung vi phạm chính sách quảng cáo',
  })
  @IsString()
  @MinLength(5, { message: 'Vui lòng nhập lý do (ít nhất 5 ký tự).' })
  @MaxLength(500)
  reason!: string;
}

/** "Thêm ghi chú nội bộ" on a link (doitac-1410 #055). */
export class AddLinkNoteDto {
  @ApiProperty({ example: 'Đã gọi đối tác xác minh nguồn traffic' })
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập nội dung ghi chú.' })
  @MaxLength(1000, { message: 'Ghi chú tối đa 1000 ký tự.' })
  body!: string;
}

/** An admin brings back a deleted link (doitac-1410 #053, #055). */
export class AdminRestoreLinkDto {
  @ApiProperty({ example: 'Đối tác xoá nhầm, đã xác minh qua điện thoại' })
  @IsString()
  @MinLength(5, { message: 'Vui lòng nhập lý do (ít nhất 5 ký tự).' })
  @MaxLength(500)
  reason!: string;
}

export class DecideLinkRestoreDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional({ example: 'Đã xác minh link đang in trên ấn phẩm' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
