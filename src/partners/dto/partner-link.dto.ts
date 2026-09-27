import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
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
