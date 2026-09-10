import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PartnerLegalTypeEnum, PartnerTypeEnum } from '../partners.enum';

export class PartnerApplyDto {
  @ApiProperty({ enum: PartnerTypeEnum })
  @IsEnum(PartnerTypeEnum)
  partnerType!: PartnerTypeEnum;

  @ApiProperty({ enum: PartnerLegalTypeEnum })
  @IsEnum(PartnerLegalTypeEnum)
  legalType!: PartnerLegalTypeEnum;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  contactName!: string;

  @ApiProperty({ example: '+84901234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  contactPhone!: string;

  @ApiProperty({ example: 'partner@example.com' })
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ example: 'S3cret123!' })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH ABC' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ example: '0312345678' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxCode?: string;

  @ApiPropertyOptional({ example: '123 Nguyen Hue, Q1, TPHCM' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessAddress?: string;

  @ApiPropertyOptional({
    description:
      'Free-form info about marketing channels (KOL) or distribution channels — social links, follower count, sales region, etc.',
    example: {
      channel: 'tiktok',
      url: 'https://tiktok.com/@abc',
      followers: 50000,
    },
  })
  @IsOptional()
  channelInfo?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Muốn hợp tác lâu dài' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
