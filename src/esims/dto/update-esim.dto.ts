import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateEsimDto } from './create-esim.dto';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateEsimDto extends PartialType(CreateEsimDto) {
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

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  iccid?: string;

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
  status?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  dataUsed?: string | null;

  @ApiPropertyOptional({ type: String })
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
