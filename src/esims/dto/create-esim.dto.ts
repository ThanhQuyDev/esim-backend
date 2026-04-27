import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class CreateEsimDto {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  orderItemId?: number | null;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  userId?: number | null;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  planId?: number | null;

  @ApiProperty({ example: '8901234567890123456', type: String })
  @IsNotEmpty()
  @IsString()
  iccid: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  smdpAddress?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  activationCode?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  lpa?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  matchId?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  qrcode?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  directAppleInstallationUrl?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  apnValue?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  isRoaming?: boolean | null;

  @ApiPropertyOptional({ example: 'available', type: String })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '500MB', type: String })
  @IsOptional()
  @IsString()
  dataUsed?: string | null;

  @ApiPropertyOptional({ example: '1GB', type: String })
  @IsOptional()
  @IsString()
  dataTotal?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  activatedAt?: Date | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  esimTranNo?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  provider?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  phoneNumber?: string | null;
}
