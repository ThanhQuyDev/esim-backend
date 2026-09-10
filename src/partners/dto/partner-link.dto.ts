import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Shortest code a partner may pick for themselves (#095). */
export const PARTNER_LINK_CODE_MIN_LENGTH = 6;
export const PARTNER_LINK_CODE_MAX_LENGTH = 32;

export class CreatePartnerLinkDto {
  @ApiProperty({ example: 'Chiến dịch TikTok tháng 9' })
  @IsString()
  @MaxLength(255)
  label!: string;

  @ApiPropertyOptional({
    example: 'VANA2026',
    description:
      'Referral code the partner picks for themselves — at least 6 characters, letters/digits/-/_ only. Leave empty to have one generated.',
  })
  @IsOptional()
  @IsString()
  @MinLength(PARTNER_LINK_CODE_MIN_LENGTH)
  @MaxLength(PARTNER_LINK_CODE_MAX_LENGTH)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message:
      'Mã giới thiệu chỉ gồm chữ, số, dấu gạch ngang và gạch dưới, không có khoảng trắng.',
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
