import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsIn,
  IsNotEmpty,
  IsInt,
} from 'class-validator';

/** Bounds for a code a partner names themselves (#014). */
export const PARTNER_LINK_CODE_MIN_LENGTH = 8;
export const PARTNER_LINK_CODE_MAX_LENGTH = 50;

export class CreatePartnerLinkDto {
  @ApiProperty({ example: 'Chiến dịch TikTok tháng 9' })
  @IsString()
  @MaxLength(255)
  label!: string;

  @ApiPropertyOptional({
    example: 'VANA2026',
    description:
      'Referral code the partner picks for themselves — 8 to 50 characters, letters and/or digits. Only partners an admin has allowed may send this; leave empty to have one generated.',
  })
  @IsOptional()
  @IsString()
  @MinLength(PARTNER_LINK_CODE_MIN_LENGTH)
  @MaxLength(PARTNER_LINK_CODE_MAX_LENGTH)
  @Matches(/^[A-Za-z0-9]+$/, {
    message:
      'Mã giới thiệu chỉ gồm chữ và số, không dấu và không khoảng trắng.',
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
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'suspended', 'deleted'] })
  @IsOptional()
  @IsIn(['active', 'inactive', 'suspended', 'deleted'])
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
