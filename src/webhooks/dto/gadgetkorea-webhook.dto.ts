import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GadgetKoreaWebhookPayloadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  topupId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iccid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  downloadLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smdp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activateCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrcodeImgUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiredDate?: string;
}
