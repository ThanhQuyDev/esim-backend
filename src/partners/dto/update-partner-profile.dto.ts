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

  // Bank details are not here on purpose: changing where the money goes needs
  // the emailed code (#005), see POST /partners/me/bank-account/otp.
}
