import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePartnerProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  channelInfo?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Branding for the partner page: { displayName, logoUrl, tagline }',
  })
  @IsOptional()
  @IsObject()
  brandInfo?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Vietcombank' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'TRAN THU HA' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankAccountHolder?: string;

  @ApiPropertyOptional({ example: 'Chi nhánh Tân Bình' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankBranch?: string;
}
